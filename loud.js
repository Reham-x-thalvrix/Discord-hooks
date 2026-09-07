"use strict";

(() => {
  if (window.__thalvrixAudioEngine) return;
  window.__thalvrixAudioEngine = true;

  const VERSION = "Thalvrix Audio Engine 1.0";

  const state = {
    enabled: true,

    input: 1,
    output: 0.85,

    bass: 0,
    mid: 0,
    treble: 0,
    clarity: 0,
    presence: 0,

    compressor: 0,
    noiseGate: 0,
    deEsser: 0,

    saturation: 0,
    distortion: 0,
    bitcrush: 0,

    reverb: 0,
    echo: 0,
    room: 0,

    stereoWidth: 0,
    haas: 0,
    pan: 0,

    robot: 0,
    deep: 0,
    radio: 0,
    alien: 0,

    autoPan: false
  };

  let ctx = null;
  let source = null;
  let destination = null;

  let inputGain;
  let bassFilter;
  let midFilter;
  let trebleFilter;
  let clarityFilter;
  let presenceFilter;

  let compressor;
  let gateGain;

  let saturation;
  let distortion;

  let delay;
  let delayFeedback;
  let echoGain;

  let convolver;
  let reverbGain;

  let stereoDelay;
  let leftGain;
  let rightGain;
  let merger;

  let masterGain;
  let limiter;
  let analyser;

  let robotOsc;
  let robotGain;

  let guiHost;

  function db(value) {
    return Math.pow(10, value / 20);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function makeCurve(amount = 0) {
    const size = 4096;
    const curve = new Float32Array(size);

    const k = Math.max(1, amount);

    for (let i = 0; i < size; i++) {
      const x = (i * 2) / size - 1;
      curve[i] =
        ((1 + k) * x) /
        (1 + k * Math.abs(x));
    }

    return curve;
  }

  function makeSoftClipCurve() {
    const size = 4096;
    const curve = new Float32Array(size);

    for (let i = 0; i < size; i++) {
      const x = (i * 2) / size - 1; // এখানে অতিরিক্ত বন্ধনী ')' টি বাদ দেওয়া হয়েছে
      curve[i] = Math.tanh(x * 1.35);
    }

    return curve;
  }

  function makeImpulse(duration = 2.5, decay = 2.4) {
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);

      for (let i = 0; i < length; i++) {
        const envelope = Math.pow(1 - i / length, decay);
        data[i] = (Math.random() * 2 - 1) * envelope;
      }
    }

    return buffer;
  }

  function createAudioGraph(stream) {
    if (ctx) {
      try {
        ctx.close();
      } catch (_) {}
    }

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    ctx = new AudioContextClass({
      latencyHint: "interactive",
      sampleRate: 48000
    });

    source = ctx.createMediaStreamSource(stream);

    inputGain = ctx.createGain();

    bassFilter = ctx.createBiquadFilter();
    bassFilter.type = "lowshelf";
    bassFilter.frequency.value = 150;

    midFilter = ctx.createBiquadFilter();
    midFilter.type = "peaking";
    midFilter.frequency.value = 900;
    midFilter.Q.value = 0.8;

    trebleFilter = ctx.createBiquadFilter();
    trebleFilter.type = "highshelf";
    trebleFilter.frequency.value = 5000;

    clarityFilter = ctx.createBiquadFilter();
    clarityFilter.type = "peaking";
    clarityFilter.frequency.value = 3200;
    clarityFilter.Q.value = 1.1;

    presenceFilter = ctx.createBiquadFilter();
    presenceFilter.type = "peaking";
    presenceFilter.frequency.value = 1800;
    presenceFilter.Q.value = 1.0;

    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.12;

    gateGain = ctx.createGain();
    gateGain.gain.value = 1;

    saturation = ctx.createWaveShaper();
    saturation.oversample = "2x";

    distortion = ctx.createWaveShaper();
    distortion.oversample = "4x";

    delay = ctx.createDelay(1);
    delay.delayTime.value = 0.18;

    delayFeedback = ctx.createGain();
    echoGain = ctx.createGain();

    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(echoGain);

    convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse();

    reverbGain = ctx.createGain();

    stereoDelay = ctx.createDelay(0.08);

    leftGain = ctx.createGain();
    rightGain = ctx.createGain();

    merger = ctx.createChannelMerger(2);

    masterGain = ctx.createGain();

    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;

    analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.82;

    robotOsc = ctx.createOscillator();
    robotGain = ctx.createGain();

    robotOsc.type = "square";
    robotOsc.frequency.value = 55;
    robotGain.gain.value = 0;

    robotOsc.connect(robotGain);
    robotOsc.start();

    source.connect(inputGain);

    inputGain.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    trebleFilter.connect(clarityFilter);
    clarityFilter.connect(presenceFilter);

    presenceFilter.connect(compressor);
    compressor.connect(gateGain);

    gateGain.connect(saturation);
    saturation.connect(distortion);

    distortion.connect(delay);
    distortion.connect(convolver);
    distortion.connect(stereoDelay);

    distortion.connect(leftGain);
    distortion.connect(rightGain);

    echoGain.connect(leftGain);
    echoGain.connect(rightGain);

    convolver.connect(reverbGain);
    reverbGain.connect(leftGain);
    reverbGain.connect(rightGain);

    robotGain.connect(leftGain);
    robotGain.connect(rightGain);

    leftGain.connect(merger, 0, 0);
    rightGain.connect(merger, 0, 1);

    merger.connect(masterGain);
    masterGain.connect(limiter);
    limiter.connect(analyser);

    destination = ctx.createMediaStreamDestination();
    analyser.connect(destination);

    applyEffects();

    return destination.stream;
  }

  function applyEffects() {
    if (!ctx) return;

    const now = ctx.currentTime;

    inputGain.gain.setTargetAtTime(
      state.enabled ? clamp(state.input, 0, 2) : 0,
      now,
      0.025
    );

    masterGain.gain.setTargetAtTime(
      clamp(state.output, 0, 1),
      now,
      0.025
    );

    bassFilter.gain.setTargetAtTime(
      state.bass,
      now,
      0.03
    );

    midFilter.gain.setTargetAtTime(
      state.mid,
      now,
      0.03
    );

    trebleFilter.gain.setTargetAtTime(
      state.treble,
      now,
      0.03
    );

    clarityFilter.gain.setTargetAtTime(
      state.clarity,
      now,
      0.03
    );

    presenceFilter.gain.setTargetAtTime(
      state.presence,
      now,
      0.03
    );

    const compAmount = state.compressor / 100;

    compressor.threshold.setTargetAtTime(
      -18 - compAmount * 24,
      now,
      0.03
    );

    compressor.ratio.setTargetAtTime(
      2 + compAmount * 10,
      now,
      0.03
    );

    saturation.curve =
      state.saturation <= 0
        ? null
        : makeCurve(1 + state.saturation / 10);

    distortion.curve =
      state.distortion <= 0
        ? null
        : makeSoftClipCurve();

    delayFeedback.gain.setTargetAtTime(
      (state.echo / 100) * 0.62,
      now,
      0.04
    );

    echoGain.gain.setTargetAtTime(
      state.echo / 100,
      now,
      0.04
    );

    reverbGain.gain.setTargetAtTime(
      state.reverb / 100,
      now,
      0.05
    );

    stereoDelay.delayTime.setTargetAtTime(
      state.haas / 1000,
      now,
      0.03
    );

    const width = state.stereoWidth / 100;

    leftGain.gain.setTargetAtTime(
      clamp(1 + width * 0.5, 0, 1.7),
      now,
      0.03
    );

    rightGain.gain.setTargetAtTime(
      clamp(1 + width * 0.5, 0, 1.7),
      now,
      0.03
    );

    const pan = state.pan / 100;

    if (pan < 0) {
      rightGain.gain.setTargetAtTime(
        1 + pan,
        now,
        0.03
      );
    } else {
      leftGain.gain.setTargetAtTime(
        1 - pan,
        now,
        0.03
      );
    }

    const robot = state.robot / 100;

    robotGain.gain.setTargetAtTime(
      robot * 0.08,
      now,
      0.05
    );

    robotOsc.frequency.setTargetAtTime(
      45 + robot * 70,
      now,
      0.05
    );

    applyVoiceModes();
  }

  function applyVoiceModes() {
    if (!ctx) return;

    const now = ctx.currentTime;

    const deep = state.deep / 100;
    const radio = state.radio / 100;
    const alien = state.alien / 100;

    bassFilter.gain.setTargetAtTime(
      state.bass + deep * 7,
      now,
      0.04
    );

    midFilter.gain.setTargetAtTime(
      state.mid - radio * 4,
      now,
      0.04
    );

    trebleFilter.gain.setTargetAtTime(
      state.treble - deep * 3 - radio * 8,
      now,
      0.04
    );

    presenceFilter.frequency.setTargetAtTime(
      1800 + alien * 1800,
      now,
      0.04
    );

    if (radio > 0.01) {
      bassFilter.frequency.setTargetAtTime(
        300,
        now,
        0.05
      );

      trebleFilter.frequency.setTargetAtTime(
        3200,
        now,
        0.05
      );
    } else {
      bassFilter.frequency.setTargetAtTime(
        150,
        now,
        0.05
      );

      trebleFilter.frequency.setTargetAtTime(
        5000,
        now,
        0.05
      );
    }
  }

  function createUI() {
    if (guiHost) guiHost.remove();

    guiHost = document.createElement("div");
    guiHost.id = "thalvrix-ui";

    Object.assign(guiHost.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      pointerEvents: "none"
    });

    document.documentElement.appendChild(guiHost);

    const shadow = guiHost.attachShadow({
      mode: "open"
    });

    shadow.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
          font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .panel {
          position: fixed;
          top: 28px;
          right: 28px;
          width: 410px;
          max-height: calc(100vh - 56px);
          overflow: hidden;

          color: #fff;

          background:
            linear-gradient(
              165deg,
              #062b68 0%,
              #0755b9 28%,
              #1683df 58%,
              #7ac8ff 100%
            );

          border: 1px solid rgba(255,255,255,.28);
          border-radius: 24px;

          box-shadow:
            0 25px 70px rgba(0,20,70,.55),
            inset 0 1px 0 rgba(255,255,255,.28);

          backdrop-filter: blur(22px);

          pointer-events: auto;
          overflow-y: auto;
        }

        .panel::-webkit-scrollbar {
          width: 5px;
        }

        .panel::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,.35);
          border-radius: 10px;
        }

        .top {
          position: sticky;
          top: 0;
          z-index: 4;

          padding: 20px;

          background:
            linear-gradient(
              135deg,
              rgba(2,27,73,.94),
              rgba(13,93,190,.88)
            );

          backdrop-filter: blur(20px);

          border-bottom:
            1px solid rgba(255,255,255,.15);
        }

        .brand {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo {
          font-size: 21px;
          font-weight: 900;
          letter-spacing: -.7px;
        }

        .version {
          padding: 5px 9px;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 800;
          background: rgba(255,255,255,.14);
          border: 1px solid rgba(255,255,255,.18);
        }

        .sub {
          margin-top: 5px;
          color: rgba(255,255,255,.7);
          font-size: 11px;
        }

        .status {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 14px;
          font-size: 10px;
          font-weight: 700;
          color: rgba(255,255,255,.78);
        }

        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #b9edff;
          box-shadow: 0 0 12px #b9edff;
        }

        .content {
          padding: 14px;
        }

        .section {
          margin-bottom: 10px;
          border-radius: 17px;
          overflow: hidden;

          background: rgba(2,31,77,.25);
          border: 1px solid rgba(255,255,255,.15);

          transition:
            transform .2s ease,
            background .2s ease;
        }

        .section.open {
          background: rgba(2,31,77,.32);
        }

        .section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;

          padding: 15px;

          cursor: pointer;
          user-select: none;
        }

        .section-title {
          display: flex;
          gap: 10px;
          align-items: center;

          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.3px;
        }

        .icon {
          width: 28px;
          height: 28px;

          display: grid;
          place-items: center;

          border-radius: 9px;

          background: rgba(255,255,255,.14);
        }

        .arrow {
          transition: transform .25s ease;
        }

        .section.open .arrow {
          transform: rotate(180deg);
        }

        .section-body {
          display: none;
          padding: 0 15px 16px;
        }

        .section.open .section-body {
          display: block;
          animation: appear .18s ease;
        }

        @keyframes appear {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .control {
          padding: 10px 0;
        }

        .label {
          display: flex;
          justify-content: space-between;
          align-items: center;

          margin-bottom: 9px;

          font-size: 11px;
          font-weight: 700;
        }

        .value {
          color: rgba(255,255,255,.78);
          font-variant-numeric: tabular-nums;
        }

        input[type=range] {
          width: 100%;
          height: 5px;

          appearance: none;
          border-radius: 10px;
          outline: none;

          background: rgba(255,255,255,.2);
        }

        input[type=range]::-webkit-slider-thumb {
          appearance: none;

          width: 16px;
          height: 16px;

          border-radius: 50%;
          border: 2px solid rgba(255,255,255,.9);

          background: #fff;

          box-shadow:
            0 0 0 4px rgba(255,255,255,.12),
            0 3px 10px rgba(0,0,0,.3);

          cursor: pointer;
        }

        .switch {
          width: 43px;
          height: 23px;

          padding: 3px;

          border-radius: 20px;

          background: rgba(0,0,0,.25);
          cursor: pointer;
        }

        .switch i {
          display: block;

          width: 17px;
          height: 17px;

          border-radius: 50%;
          background: white;

          transition: transform .2s ease;
        }

        .switch.on {
          background: rgba(255,255,255,.35);
        }

        .switch.on i {
          transform: translateX(20px);
        }

        .mode-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .mode {
          padding: 11px;

          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.14);

          color: white;
          background: rgba(0,0,0,.16);

          cursor: pointer;
          font-size: 10px;
          font-weight: 800;

          transition:
            transform .15s ease,
            background .15s ease;
        }

        .mode:hover {
          transform: translateY(-1px);
          background: rgba(255,255,255,.15);
        }

        .mode.active {
          background: rgba(255,255,255,.28);
          border-color: rgba(255,255,255,.45);
        }

        .meter {
          display: flex;
          align-items: flex-end;
          gap: 3px;
          height: 38px;
          padding: 8px 10px;

          border-radius: 12px;
          background: rgba(0,0,0,.18);
        }

        .bar {
          flex: 1;
          min-width: 2px;
          height: 4px;

          border-radius: 5px;
          background: rgba(255,255,255,.22);

          transition:
            height .06s linear,
            background .06s linear;
        }

        .footer {
          padding: 12px 16px 18px;
          text-align: center;

          font-size: 9px;
          font-weight: 700;

          color: rgba(255,255,255,.55);
        }
      </style>

      <div class="panel">
        <div class="top">
          <div class="brand">
            <div>
              <div class="logo">THALVRIX</div>
              <div class="sub">Realtime Voice Processing Engine</div>
            </div>

            <div class="version">v1.0</div>
          </div>

          <div class="status">
            <span class="dot"></span>
            AUDIO ENGINE READY
          </div>

          <div class="meter" id="meter">
            ${Array(28).fill('<span class="bar"></span>').join("")}
          </div>
        </div>

        <div class="content">

          <div class="section open">
            <div class="section-head">
              <div class="section-title">
                <span class="icon">◉</span>
                ENGINE
              </div>
              <span class="arrow">⌄</span>
            </div>

            <div class="section-body">
              ${control("Input", "input", 0, 2, 0.01, 1, "x")}
              ${control("Output", "output", 0, 1, 0.01, .85, "%")}
            </div>
          </div>

          <div class="section open">
            <div class="section-head">
              <div class="section-title">
                <span class="icon">♫</span>
                VOICE
              </div>
              <span class="arrow">⌄</span>
            </div>

            <div class="section-body">
              ${control("Bass", "bass", -12, 12, .1, 0, " dB")}
              ${control("Mid", "mid", -12, 12, .1, 0, " dB")}
              ${control("Treble", "treble", -12, 12, .1, 0, " dB")}
              ${control("Clarity", "clarity", 0, 12, .1, 0, " dB")}
              ${control("Presence", "presence", 0, 12, .1, 0, " dB")}
              ${control("Compressor", "compressor", 0, 100, 1, 0, "%")}
            </div>
          </div>

          <div class="section open">
            <div class="section-head">
              <div class="section-title">
                <span class="icon">◈</span>
                VOICE MODES
              </div>
              <span class="arrow">⌄</span>
            </div>

            <div class="section-body">
              <div class="mode-grid">
                <button class="mode" data-mode="robot">🤖 Robot</button>
                <button class="mode" data-mode="deep">🎙 Deep Voice</button>
                <button class="mode" data-mode="radio">📻 Radio</button>
                <button class="mode" data-mode="alien">👽 Alien</button>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-head">
              <div class="section-title">
                <span class="icon">◇</span>
                SPACE
              </div>
              <span class="arrow">⌄</span>
            </div>

            <div class="section-body">
              ${control("Reverb", "reverb", 0, 100, 1, 0, "%")}
              ${control("Echo", "echo", 0, 100, 1, 0, "%")}
              ${control("Room Size", "room", 0, 100, 1, 0, "%")}
            </div>
          </div>

          <div class="section">
            <div class="section-head">
              <div class="section-title">
                <span class="icon">↔</span>
                STEREO
              </div>
              <span class="arrow">⌄</span>
            </div>

            <div class="section-body">
              ${control("Stereo Width", "stereoWidth", 0, 100, 1, 0, "%")}
              ${control("Haas", "haas", 0, 40, 1, 0, " ms")}
              ${control("Pan", "pan", -100, 100, 1, 0, "%")}
            </div>
          </div>

          <div class="section">
            <div class="section-head">
              <div class="section-title">
                <span class="icon">△</span>
                CHARACTER
              </div>
              <span class="arrow">⌄</span>
            </div>

            <div class="section-body">
              ${control("Saturation", "saturation", 0, 100, 1, 0, "%")}
              ${control("Distortion", "distortion", 0, 100, 1, 0, "%")}
              ${control("Bit Crush", "bitcrush", 0, 100, 1, 0, "%")}
              ${control("De-Esser", "deEsser", 0, 100, 1, 0, "%")}
              ${control("Noise Gate", "noiseGate", 0, 100, 1, 0, "%")}
            </div>
          </div>

          <div class="section">
            <div class="section-head">
              <div class="section-title">
                <span class="icon">✦</span>
                EXTRAS
              </div>
              <span class="arrow">⌄</span>
            </div>

            <div class="section-body">
              <div class="control">
                <div class="label">
                  <span>Auto Pan</span>
                  <div class="switch" id="autoPan">
                    <i></i>
                  </div>
                </div>
              </div>

              ${control("Robot Amount", "robot", 0, 100, 1, 0, "%")}
              ${control("Deep Voice", "deep", 0, 100, 1, 0, "%")}
              ${control("Radio", "radio", 0, 100, 1, 0, "%")}
              ${control("Alien", "alien", 0, 100, 1, 0, "%")}
            </div>
          </div>

          <div class="footer">
            THALVRIX • REALTIME AUDIO ENGINE
          </div>

        </div>
      </div>
    `;

    function control(label, key, min, max, step, value, suffix) {
      return `
        <div class="control">
          <div class="label">
            <span>${label}</span>
            <span class="value" id="value-${key}">
              ${formatValue(value, suffix)}
            </span>
          </div>

          <input
            type="range"
            id="range-${key}"
            min="${min}"
            max="${max}"
            step="${step}"
            value="${value}"
          >
        </div>
      `;
    }

    function formatValue(value, suffix) {
      if (suffix === "%") {
        return Math.round(value * 100) + "%";
      }

      if (suffix === "x") {
        return Number(value).toFixed(2) + "x";
      }

      return Number(value).toFixed(
        Number(value) % 1 === 0 ? 0 : 1
      ) + suffix;
    }

    const ranges = shadow.querySelectorAll("input[type=range]");

    ranges.forEach(slider => {
      const key = slider.id.replace("range-", "");
      const output = shadow.getElementById(`value-${key}`);

      slider.addEventListener("input", () => {
        state[key] = Number(slider.value);

        let suffix = "%";

        if (
          key === "bass" ||
          key === "mid" ||
          key === "treble" ||
          key === "clarity" ||
          key === "presence"
        ) suffix = " dB";

        if (key === "haas") suffix = " ms";
        if (key === "input") suffix = "x";

        output.textContent = formatValue(
          state[key],
          suffix
        );

        applyEffects();
      });
    });

    shadow.querySelectorAll(".section-head").forEach(head => {
      head.addEventListener("click", () => {
        head.parentElement.classList.toggle("open");
      });
    });

    const autoPan = shadow.getElementById("autoPan");

    autoPan.addEventListener("click", () => {
      state.autoPan = !state.autoPan;
      autoPan.classList.toggle("on", state.autoPan);
    });

    shadow.querySelectorAll(".mode").forEach(button => {
      button.addEventListener("click", () => {
        const mode = button.dataset.mode;

        const key = mode;

        state[key] =
          state[key] >= 100 ? 0 : 100;

        button.classList.toggle(
          "active",
          state[key] > 0
        );

        const slider =
          shadow.getElementById(`range-${key}`);

        if (slider) {
          slider.value = state[key];
          slider.dispatchEvent(
            new Event("input")
          );
        }

        applyEffects();
      });
    });

    startMeter(shadow);
  }

  function startMeter(shadow) {
    const bars =
      shadow.querySelectorAll(".bar");

    const data =
      new Uint8Array(32);

    function update() {
      if (analyser) {
        analyser.getByteFrequencyData(data);

        for (let i = 0; i < bars.length; i++) {
          const value =
            data[i % data.length] / 255;

          bars[i].style.height =
            `${Math.max(4, value * 30)}px`;
        }
      }

      requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }

  function unlock() {
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  window.addEventListener("click", unlock, {
    passive: true
  });

  window.addEventListener("keydown", unlock, {
    passive: true
  });

  function hookMicrophone() {
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) return;

    const original =
      navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices
      );

    navigator.mediaDevices.getUserMedia =
      async function (constraints) {

        const requested =
          constraints || { audio: true };

        if (!requested.audio) {
          return original(requested);
        }

        const audioConstraints = {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: { ideal: 2 }
        };

        const cleanConstraints = {
          ...requested,
          audio: audioConstraints
        };

        try {
          const inputStream =
            await original(cleanConstraints);

          if (!state.enabled) {
            return inputStream;
          }

          const processed =
            createAudioGraph(inputStream);

          inputStream
            .getVideoTracks()
            .forEach(track => {
              processed.addTrack(track);
            });

          return processed;
        } catch (error) {
          console.error(
            "[Thalvrix] Audio error:",
            error
          );

          return original(requested);
        }
      };
  }

  function start() {
    createUI();
    hookMicrophone();

    console.log(
      `%c${VERSION}`,
      "color:#55baff;font-weight:900"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      { once: true }
    );
  } else {
    start();
  }
})();
