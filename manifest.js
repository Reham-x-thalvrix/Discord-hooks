{
  "manifest_version": 3,
  "name": "Thalvrix Audio Engine",
  "version": "1.0.0",
  "description": "Realtime voice processing and audio effects engine by Thalvrix.",
  "author": "Thalvrix",

  "permissions": [
    "scripting"
  ],

  "host_permissions": [
    "<all_urls>"
  ],

  "content_scripts": [
    {
      "matches": [
        "<all_urls>"
      ],
      "js": [
        "injector.js"
      ],
      "run_at": "document_start"
    }
  ],

  "web_accessible_resources": [
    {
      "resources": [
        "loud.js"
      ],
      "matches": [
        "<all_urls>"
      ]
    }
  ],

  "action": {
    "default_title": "Thalvrix Audio Engine"
  }
}
