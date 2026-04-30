// ═══════════════════════════════════════════════════════════
// DirectSpeed — background.js v2
// Auto-restart, alternância de mensagens, resiliência total
// ═══════════════════════════════════════════════════════════

const AUTH_SERVER = "https://directspeed-auth.onrender.com";

let botRunning  = false;
let botPaused   = false;
let currentTabId = null;

// ─── Utilitários ────────────────────────────────────────────
function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function randDelay(minSec, maxSec) {
  const mn = minSec * 1000;
  const mx = maxSec * 1000;
  return Math.floor(Math.random() * (mx - mn + 1)) + mn;
}

function log(msg, type = "") {
  chrome.storage.local.get("ds_logs", ({ ds_logs }) => {
    const logs = ds_logs || [];
    const time = new Date().toLocaleTimeString("pt-BR");
    logs.unshift({ time, msg, type });
    if (logs.length > 300) logs.pop();
    chrome.storage.local.set({ ds_logs: logs });
  });
  chrome.runtime.sendMessage({
    type: "LOG",
    time: new Date().toLocaleTimeString("pt-BR"),
    msg,
    logType: type
  }).catch(() => {});
}

function setStatus(txt) {
  chrome.storage.local.set({ ds_status: txt });
  chrome.runtime.sendMessage({ type: "STATUS_UPDATE", status: txt }).catch(() => {});
}

// ─── Validação da chave ─────────────────────────────────────
async function validateKey(key) {
  try {
    const resp = await fetch(`${AUTH_SERVER}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key })
    });
    return await resp.json();
  } catch (e) {
    return { valid: false, reason: "Servidor de autenticação indisponível." };
  }
}

// ─── Abre o Instagram ────────────────────────────────────────
async function openInstagram() {
  try {
    const tabs = await chrome.tabs.query({ url: "https://www.instagram.com/*" });
    if (tabs.length > 0) {
      currentTabId = tabs[0].id;
      await chrome.tabs.update(currentTabId, { active: true });
    } else {
      const tab = await chrome.tabs.create({ url: "https://www.instagram.com/" });
      currentTabId = tab.id;
      await new Promise(resolve => {
        const listener = (tabId, info) => {
          if (tabId === tab.id && info.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
    }
    return currentTabId;
  } catch (e) {
    log("Erro ao abrir Instagram: " + e.message, "err");
    throw e;
  }
}

// ─── Executa função na aba ───────────────────────────────────
async function execInTab(tabId, func, args = []) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func,
      args
    });
    return results[0]?.result;
  } catch (e) {
    return null;
  }
}

// ─── Navega para um perfil ───────────────────────────────────
async function navigateToProfile(tabId, username) {
  await chrome.tabs.update(tabId, { url: `https://www.instagram.com/${username}/` });
  await new Promise(resolve => {
    const listener = (tid, info) => {
      if (tid === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    // Timeout de segurança: 15s
    setTimeout(resolve, 15000);
  });
  await delay(3500);
}

// ─── Envia DM para um perfil — resiliente ───────────────────
async function sendDM(tabId, username, message) {
  setStatus(`Abrindo perfil @${username}`);
  await navigateToProfile(tabId, username);

  // Verifica login
  const url = await execInTab(tabId, () => window.location.href);
  if (!url || url.includes("/accounts/login")) {
    throw new Error("Instagram não está logado.");
  }

  // ── Tenta encontrar qualquer botão de ação ────────────────
  setStatus("Procurando ação disponível");
  await delay(1500);

  // 1ª tentativa: "Enviar mensagem" / "Mensagem"
  let clicked = await execInTab(tabId, () => {
    const candidates = [
      "enviar mensagem",
      "mensagem",
      "message",
      "send message"
    ];
    const btns = Array.from(document.querySelectorAll("button, a, div[role='button']"));
    for (const candidate of candidates) {
      const btn = btns.find(b => {
        const t = (b.innerText || b.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
        return t === candidate || t.includes(candidate);
      });
      if (btn) { btn.scrollIntoView({ block: "center" }); btn.click(); return "msg"; }
    }
    return null;
  });

  if (!clicked) {
    log(`@${username} — Nenhuma ação encontrada, avançando`, "warn");
    setStatus("Nenhuma ação encontrada, avançando");
    return "skipped";
  }

  setStatus("Enviando mensagem");
  await delay(4500);

  // Se aparecer modal de "Enviar solicitação de contato"
  await execInTab(tabId, () => {
    const btns = Array.from(document.querySelectorAll("button, div[role='button'], a"));
    const contact = btns.find(b => {
      const t = (b.innerText || b.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
      return t.includes("enviar solicitação") || t.includes("send contact") || t.includes("contact request");
    });
    if (contact) { contact.click(); return true; }
    return false;
  });

  await delay(4000);

  // ── Digita a mensagem ─────────────────────────────────────
  const typed = await execInTab(tabId, (msg) => {
    // Tenta todos os contenteditable da página
    const boxes = Array.from(document.querySelectorAll('[contenteditable="true"]'));
    const box = boxes[boxes.length - 1];
    if (!box) return false;
    box.focus();
    const dt = new DataTransfer();
    dt.setData("text/plain", msg);
    box.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
    return true;
  }, [message]);

  if (!typed) {
    log(`@${username} — Campo de mensagem não encontrado`, "err");
    setStatus("Campo de mensagem não encontrado, avançando");
    return "skipped";
  }

  await delay(1200);

  // ── Envia com Enter ───────────────────────────────────────
  await execInTab(tabId, () => {
    const boxes = Array.from(document.querySelectorAll('[contenteditable="true"]'));
    const box = boxes[boxes.length - 1];
    if (box) {
      box.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter", code: "Enter", keyCode: 13, bubbles: true
      }));
    }
  });

  await delay(1500);

  // Fallback: botão enviar
  await execInTab(tabId, () => {
    const sendBtn =
      document.querySelector('[aria-label="Enviar"]') ||
      document.querySelector('[aria-label="Send"]') ||
      Array.from(document.querySelectorAll("button")).find(b =>
        (b.innerText || "").toLowerCase().trim() === "enviar"
      );
    if (sendBtn) sendBtn.click();
  });

  await delay(1000);
  return "sent";
}

// ─── Busca por nicho via Google ──────────────────────────────
async function searchNiche(query, maxResults) {
  const tabId = await openInstagram();
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent("site:instagram.com " + query)}&num=30`;

  await chrome.tabs.update(tabId, { url: searchUrl });
  await new Promise(resolve => {
    const listener = (tid, info) => {
      if (tid === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(resolve, 10000);
  });
  await delay(2500);

  const handles = await execInTab(tabId, (max) => {
    const igBlacklist = ["p","reel","reels","stories","explore","accounts","tv","shop","legal","about","blog","help","contact","hashtag","directory"];
    const found = new Set();
    document.querySelectorAll("a[href]").forEach(a => {
      const m = a.href.match(/instagram\.com\/([a-zA-Z0-9_.]{2,30})\/?(?:\?|$)/);
      if (m && !igBlacklist.includes(m[1].toLowerCase())) found.add(m[1].toLowerCase());
    });
    const text = document.body.innerText;
    (text.match(/@([a-zA-Z0-9_.]{2,30})/g) || []).forEach(h => {
      const clean = h.replace("@","").toLowerCase();
      if (!igBlacklist.includes(clean)) found.add(clean);
    });
    return Array.from(found).slice(0, max);
  }, [maxResults]);

  await chrome.tabs.update(tabId, { url: "https://www.instagram.com/" });
  return handles || [];
}

// ─── Valida perfil ───────────────────────────────────────────
async function validateProfile(username) {
  const tabId = await openInstagram();
  await navigateToProfile(tabId, username);
  const result = await execInTab(tabId, () => {
    const url = window.location.href;
    if (url.includes("/accounts/login") || url.includes("page_not_found"))
      return { valid: false, reason: "Perfil não encontrado" };
    const isPrivate = !!document.querySelector('[data-testid="private_account_notice"]') ||
      Array.from(document.querySelectorAll("h2,p,span")).some(el => el.innerText?.includes("Essa conta é privada"));
    if (isPrivate) return { valid: false, reason: "Conta privada" };
    const hasMsg = Array.from(document.querySelectorAll("button, div[role='button']")).some(b => {
      const t = (b.innerText || "").toLowerCase();
      return t.includes("mensagem") || t.includes("message");
    });
    return { valid: hasMsg, reason: hasMsg ? "OK" : "Sem botão de mensagem" };
  });
  return result || { valid: false, reason: "Erro ao validar" };
}

// ─── LOOP PRINCIPAL — resiliente com auto-restart ────────────
async function runBot(settings) {
  botRunning = true;
  botPaused  = false;

  // Contador de alternância de mensagens (persistido)
  let { ds_msg_counter } = await chrome.storage.local.get("ds_msg_counter");
  let msgCounter = ds_msg_counter || 0;

  log("▶ Missão iniciada", "ok");
  setStatus("Missão rodando");
  chrome.runtime.sendMessage({ type: "BOT_STATUS", running: true }).catch(() => {});

  let tabId;
  try { tabId = await openInstagram(); }
  catch (e) {
    log("Não foi possível abrir o Instagram: " + e.message, "err");
    botRunning = false;
    chrome.runtime.sendMessage({ type: "BOT_STATUS", running: false }).catch(() => {});
    return;
  }

  while (botRunning && !botPaused) {
    try {
      // ── Lê estado atual ────────────────────────────────────
      const { ds_leads, ds_sent_history } = await chrome.storage.local.get(["ds_leads","ds_sent_history"]);
      const leads   = ds_leads || [];
      const history = ds_sent_history || {};
      const todayStr = new Date().toLocaleDateString("pt-BR");
      const todaySent = leads.filter(l => l.sentDate === todayStr).length;

      // ── Limite diário ──────────────────────────────────────
      if (todaySent >= settings.dailyLimit) {
        log("Limite diário atingido. Missão pausada.", "warn");
        setStatus("Limite diário atingido");
        break;
      }

      // ── Verifica pendentes ─────────────────────────────────
      const pending = leads.filter(l => l.status === "pendente");
      if (!pending.length) {
        log("✓ Missão concluída! Todos os leads processados.", "ok");
        setStatus("Missão concluída");

        // Auto-restart se ativado
        if (settings.autoRestart) {
          log("↺ Auto-restart: resetando fila e reiniciando...", "warn");
          setStatus("Erro detectado, reiniciando missão");
          await delay(5000);
          // Reseta pendentes
          const reset = leads.map(l => ({...l, status:"pendente", date:null, sentDate:null, error:null}));
          await chrome.storage.local.set({ ds_leads: reset });
          chrome.runtime.sendMessage({ type: "LEADS_UPDATE" }).catch(() => {});
          continue;
        }
        break;
      }

      // ── Seleciona lead ─────────────────────────────────────
      let lead;
      if (settings.order === "aleatorio") {
        lead = pending[Math.floor(Math.random() * pending.length)];
      } else {
        lead = pending[0];
      }

      const idx = leads.findIndex(l => l.username === lead.username);
      if (idx === -1) continue;

      // ── Determina qual mensagem usar ───────────────────────
      const switchEvery = settings.switchEvery || 20;
      const useMsg2 = settings.message2 && Math.floor(msgCounter / switchEvery) % 2 === 1;
      const activeMsg = useMsg2 ? settings.message2 : settings.message1;
      const activeMsgLabel = useMsg2 ? "Mensagem 2" : "Mensagem 1";

      // Notifica popup sobre qual mensagem está ativa
      chrome.runtime.sendMessage({ type: "MSG_ACTIVE", label: activeMsgLabel, counter: msgCounter }).catch(() => {});

      // ── Atualiza status do lead ────────────────────────────
      leads[idx].status = "processando";
      leads[idx].date   = new Date().toLocaleString("pt-BR");
      await chrome.storage.local.set({ ds_leads: leads });
      chrome.runtime.sendMessage({ type: "LEADS_UPDATE" }).catch(() => {});

      log(`Enviando @${lead.username} [${activeMsgLabel}]...`, "warn");

      // ── Tenta enviar ───────────────────────────────────────
      let sendResult;
      try {
        const finalMsg = activeMsg.replace("{user}", "@" + lead.username);
        sendResult = await sendDM(tabId, lead.username, finalMsg);
      } catch (sendErr) {
        sendResult = "error:" + sendErr.message;
      }

      // ── Processa resultado ─────────────────────────────────
      if (sendResult === "sent") {
        leads[idx].status   = "enviado";
        leads[idx].sentDate = todayStr;
        leads[idx].date     = new Date().toLocaleString("pt-BR");
        history[lead.username] = leads[idx].date;
        await chrome.storage.local.set({ ds_leads: leads, ds_sent_history: history });
        msgCounter++;
        await chrome.storage.local.set({ ds_msg_counter: msgCounter });

        // Aviso de alternância
        if (msgCounter > 0 && msgCounter % switchEvery === 0) {
          const nextLabel = Math.floor(msgCounter / switchEvery) % 2 === 1 ? "Mensagem 2" : "Mensagem 1";
          log(`↔ Alternando para ${nextLabel}`, "warn");
          setStatus(`Alternando para ${nextLabel}`);
        }

        log(`✓ Enviado @${lead.username} [${activeMsgLabel}]`, "ok");
        setStatus("Missão rodando");

      } else if (sendResult === "skipped") {
        leads[idx].status = "erro";
        leads[idx].error  = "Ação não encontrada";
        leads[idx].date   = new Date().toLocaleString("pt-BR");
        await chrome.storage.local.set({ ds_leads: leads });
        log(`→ @${lead.username} ignorado (sem ação disponível)`, "warn");

      } else {
        // Erro real
        const errMsg = sendResult.replace("error:", "");
        leads[idx].status = "erro";
        leads[idx].error  = errMsg;
        leads[idx].date   = new Date().toLocaleString("pt-BR");
        await chrome.storage.local.set({ ds_leads: leads });
        log(`✗ Erro @${lead.username}: ${errMsg}`, "err");
        setStatus("Erro detectado, reiniciando missão");

        if (settings.autoRestart) {
          log("↺ Auto-restart ativo, continuando...", "warn");
          await delay(3000);
        }
      }

      chrome.runtime.sendMessage({ type: "LEADS_UPDATE" }).catch(() => {});

      // ── Delay entre envios ─────────────────────────────────
      if (botRunning && !botPaused) {
        const wait = randDelay(settings.minDelay, settings.maxDelay);
        log(`⏱ Aguardando ${Math.round(wait / 1000)}s...`);
        setStatus("Missão rodando");
        await delay(wait);
      }

    } catch (loopErr) {
      // Erro inesperado no loop — nunca deixa travar
      log(`⚠ Erro inesperado no loop: ${loopErr.message}`, "err");
      setStatus("Erro detectado, reiniciando missão");

      if (settings.autoRestart) {
        log("↺ Auto-restart ativo, reiniciando em 5s...", "warn");
        await delay(5000);
        // Tenta reabrir o Instagram
        try { tabId = await openInstagram(); } catch (_) {}
        continue;
      } else {
        break;
      }
    }
  }

  botRunning = false;
  chrome.runtime.sendMessage({ type: "BOT_STATUS", running: false }).catch(() => {});
  setStatus(botPaused ? "Missão pausada" : "Missão parada");
  log("■ Bot parado.", "warn");
}

// ─── Listeners ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {

    case "VALIDATE_KEY":
      validateKey(msg.key).then(sendResponse);
      return true;

    case "OPEN_INSTAGRAM":
      openInstagram().then(tabId => sendResponse({ ok: true, tabId })).catch(e => sendResponse({ ok: false, error: e.message }));
      return true;

    case "START_BOT":
      if (!botRunning) {
        runBot(msg.settings).catch(e => {
          log("Erro crítico no bot: " + e.message, "err");
          botRunning = false;
          chrome.runtime.sendMessage({ type: "BOT_STATUS", running: false }).catch(() => {});
        });
      }
      sendResponse({ ok: true });
      break;

    case "PAUSE_BOT":
      botPaused = true;
      botRunning = false;
      log("⏸ Missão pausada.", "warn");
      setStatus("Missão pausada");
      chrome.runtime.sendMessage({ type: "BOT_STATUS", running: false }).catch(() => {});
      sendResponse({ ok: true });
      break;

    case "BOT_RUNNING":
      sendResponse({ running: botRunning });
      break;

    case "SEARCH_NICHE":
      searchNiche(msg.query, msg.maxResults || 20)
        .then(handles => sendResponse({ handles }))
        .catch(() => sendResponse({ handles: [] }));
      return true;

    case "VALIDATE_PROFILE":
      validateProfile(msg.username)
        .then(result => sendResponse(result))
        .catch(() => sendResponse({ valid: false, reason: "Erro ao validar" }));
      return true;

    case "RESET_MSG_COUNTER":
      chrome.storage.local.set({ ds_msg_counter: 0 });
      sendResponse({ ok: true });
      break;
  }
});
