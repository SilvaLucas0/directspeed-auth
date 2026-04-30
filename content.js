// ═══════════════════════════════════════════════════════════
// DirectSpeed — content.js
// Injetado nas páginas do Instagram pelo manifest
// Serve como ponte para ações DOM que o background não acessa
// ═══════════════════════════════════════════════════════════

// Sinaliza que o content script está ativo
chrome.runtime.sendMessage({ type: "CONTENT_READY", url: window.location.href }).catch(() => {});

// Listener para ações vindas do background via scripting.executeScript
// (as funções são passadas diretamente pelo background, esse arquivo
//  serve principalmente para injeção futura de helpers)
window.__directspeed = {
  version: "1.0.0",
  ready: true
};
