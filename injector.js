"use strict";

(() => {
  if (window.__thalvrixInjectorLoaded) return;
  window.__thalvrixInjectorLoaded = true;

  const SCRIPT_ID = "thalvrix-audio-engine";

  function inject() {
    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = chrome.runtime.getURL("loud.js");
    script.async = false;

    (document.head || document.documentElement).appendChild(script);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject, { once: true });
  } else {
    inject();
  }

  const observer = new MutationObserver(() => {
    if (!document.getElementById(SCRIPT_ID)) inject();
  });

  const startObserver = () => {
    if (!document.documentElement) return;
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  };

  startObserver();
})();
