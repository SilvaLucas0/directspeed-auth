// ═══════════════════════════════════════════════════════════
// DirectSpeed — panel.js v3.0
// Painel flutuante arrastável — somente modo Disparo
// ═══════════════════════════════════════════════════════════

(function () {
  'use strict';

  if (window.__dsPanel) {
    try { chrome.runtime.onMessage.addListener(dsHandleMsg); } catch(_) {}
    return;
  }
  window.__dsPanel = true;

  let isMinimized = false;
  let dragOffX = 0, dragOffY = 0, isDragging = false;

  // ─── CSS ────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.id = 'ds-styles';
  style.textContent = `
    #ds-root {
      all: initial !important;
      position: fixed !important;
  bottom: 24px !important;
left: 24px !important;
      z-index: 2147483647 !important;
      width: 360px !important;
      font-family: -apple-system,'Segoe UI',Arial,sans-serif !important;
      border-radius: 14px !important;
      overflow: hidden !important;
      box-shadow: 0 12px 48px rgba(0,0,0,.8), 0 0 0 1px rgba(0,229,255,.12) !important;
      display: flex !important;
      flex-direction: column !important;
      max-height: 88vh !important;
      transition: width .22s ease, border-radius .22s ease, box-shadow .22s ease !important;
      user-select: none !important;
    }
    #ds-root.ds-mini {
      width: 280px !important;
      border-radius: 40px !important;
      max-height: none !important;
      box-shadow: 0 6px 28px rgba(0,0,0,.7), 0 0 0 1px rgba(0,229,255,.18) !important;
    }
    #ds-root * { box-sizing:border-box; margin:0; padding:0; font-family:inherit; }
    #ds-root {
      --a:#00e5ff; --a2:#7c3aed; --g:#00c853; --r:#ff1744; --y:#ffab00;
      --bg:#07090f; --p:#0d1117; --p2:#131920; --b:rgba(255,255,255,.07);
      --b2:rgba(255,255,255,.13); --t:#e4e8f0; --m:#4a5568; --m2:#718096;
    }

    /* ── BARRA TOPO ── */
    #ds-bar {
      background: var(--p);
      border-bottom: 1px solid var(--b);
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      cursor: grab;
    }
    #ds-bar:active { cursor: grabbing; }
    #ds-root.ds-mini #ds-bar {
      border-bottom: none;
      padding: 10px 16px;
    }
    .ds-brand {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      pointer-events: none;
    }
    .ds-brand span { color: var(--a); }
    .ds-bar-r { display: flex; align-items: center; gap: 6px; }
    .ds-mst {
      font-size: 10px;
      padding: 2px 9px;
      border-radius: 20px;
      background: var(--p2);
      border: 1px solid var(--b2);
      color: var(--m2);
      max-width: 130px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: monospace;
      pointer-events: none;
    }
    .ds-mst.on { border-color: rgba(0,200,83,.35); color: var(--g); }
    .ds-mst.w  { border-color: rgba(255,171,0,.35); color: var(--y); }
    .ds-mst.e  { border-color: rgba(255,23,68,.35);  color: var(--r); }
    .ds-ib {
      background: none;
      border: 1px solid var(--b2);
      color: var(--m2);
      border-radius: 50%;
      width: 26px;
      height: 26px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      transition: all .15s;
      flex-shrink: 0;
    }
    .ds-ib:hover { border-color: var(--a); color: var(--a); }

    /* ── BODY ── */
    #ds-body {
      background: var(--bg);
      overflow-y: auto;
      flex: 1;
      min-height: 0;
      padding: 14px;
      cursor: default;
    }
    #ds-body::-webkit-scrollbar { width: 3px; }
    #ds-body::-webkit-scrollbar-thumb { background: var(--b2); border-radius: 3px; }

    /* ── STATUS BAR ── */
    .ds-sb {
      background: var(--p2);
      border: 1px solid var(--b);
      border-radius: 8px;
      padding: 6px 11px;
      margin-bottom: 11px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .ds-st { font-size: 10px; color: var(--m2); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
    .ds-st.on { color: var(--g); } .ds-st.w { color: var(--y); } .ds-st.e { color: var(--r); }
    .ds-mb { font-size: 9px; background: rgba(0,229,255,.08); border: 1px solid rgba(0,229,255,.2); color: var(--a); border-radius: 20px; padding: 2px 7px; flex-shrink: 0; font-family: monospace; }

    /* ── STATS ── */
    .ds-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; background: var(--b); border: 1px solid var(--b); border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
    .ds-stat { background: var(--p); padding: 8px 5px; text-align: center; }
    .ds-sv { font-size: 17px; font-weight: 700; display: block; line-height: 1; font-variant-numeric: tabular-nums; color: #fff; }
    .ds-sv.c { color: var(--a); } .ds-sv.g { color: var(--g); } .ds-sv.r { color: var(--r); } .ds-sv.y { color: var(--y); }
    .ds-sl { font-size: 8px; color: var(--m2); text-transform: uppercase; letter-spacing: .7px; margin-top: 3px; display: block; font-family: monospace; }

    /* ── CARDS ── */
    .ds-card { background: var(--p); border: 1px solid var(--b); border-radius: 10px; overflow: hidden; margin-bottom: 10px; }
    .ds-card:last-child { margin-bottom: 0; }
    .ds-ch { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--b); }
    .ds-ct { font-size: 9px; font-weight: 500; text-transform: uppercase; letter-spacing: 1.2px; color: var(--m2); display: flex; align-items: center; gap: 5px; font-family: monospace; }
    .ds-cb { padding: 12px; }
    .ds-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
    .ds-dot.c { background: var(--a); box-shadow: 0 0 5px var(--a); }
    .ds-dot.p { background: var(--a2); box-shadow: 0 0 5px var(--a2); }
    .ds-dot.y { background: var(--y); box-shadow: 0 0 5px var(--y); }
    .ds-dot.g { background: var(--g); box-shadow: 0 0 5px var(--g); }
    .ds-dot.gr { background: var(--m2); }

    /* ── FORMS ── */
    #ds-root label.lbl { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: .8px; color: var(--m2); margin-bottom: 4px; font-family: monospace; }
    #ds-root input, #ds-root textarea, #ds-root select {
      width: 100%; background: var(--p2); border: 1px solid var(--b2);
      color: var(--t); border-radius: 7px; padding: 7px 9px; font-size: 12px;
      outline: none; transition: border-color .2s; margin-bottom: 8px;
      resize: vertical; font-family: inherit;
    }
    #ds-root input:focus, #ds-root textarea:focus, #ds-root select:focus { border-color: rgba(0,229,255,.4); }
    #ds-root input::placeholder, #ds-root textarea::placeholder { color: var(--m); }
    #ds-root select { appearance: none; cursor: pointer; }
    .ds-r2 { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
    .ds-r3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 7px; }

    /* ── BUTTONS ── */
    #ds-root .btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: 4px; padding: 5px 11px; border-radius: 7px;
      border: 1px solid var(--b2); background: transparent;
      color: var(--t); font-size: 11px; font-weight: 600;
      cursor: pointer; transition: all .15s; white-space: nowrap; font-family: inherit;
    }
    #ds-root .btn:hover { background: rgba(255,255,255,.05); }
    #ds-root .btn:active { transform: scale(.97); }
    #ds-root .btn:disabled { opacity: .35; cursor: not-allowed; }
    #ds-root .btn-sm { padding: 4px 8px; font-size: 10px; }
    #ds-root .btn-cy { background: var(--a); color: #000; border-color: var(--a); font-weight: 700; }
    #ds-root .btn-cy:hover { background: #33eaff; }
    #ds-root .btn-da { border-color: rgba(255,23,68,.35); color: var(--r); }
    #ds-root .btn-da:hover { background: rgba(255,23,68,.07); }
    #ds-root .btn-su { border-color: rgba(0,200,83,.35); color: var(--g); }
    #ds-root .btn-su:hover { background: rgba(0,200,83,.07); }
    #ds-root .btn-fw { width: 100%; justify-content: center; }
    .ds-cr { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 9px; }

    /* ── MISSION BUTTON ── */
    .ds-mbtn {
      width: 100%; padding: 11px; background: transparent;
      border: 1px solid var(--a); border-radius: 9px;
      color: var(--a); font-size: 13px; font-weight: 700;
      cursor: pointer; transition: all .2s;
      display: flex; align-items: center; justify-content: center; gap: 7px; font-family: inherit;
    }
    .ds-mbtn:hover { box-shadow: 0 0 20px rgba(0,229,255,.15); }
    .ds-mbtn:disabled { opacity: .35; cursor: not-allowed; }
    .ds-mbtn.run { border-color: var(--y); color: var(--y); }

    /* ── TOGGLE ── */
    .ds-tr { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; }
    .ds-tl { font-size: 10px; color: var(--t); font-family: monospace; }
    .ds-tl small { display: block; color: var(--m2); font-size: 8px; margin-top: 1px; }
    .ds-tog { position: relative; width: 32px; height: 17px; flex-shrink: 0; }
    .ds-tog input { opacity: 0; width: 0; height: 0; position: absolute; }
    .ds-tt { position: absolute; inset: 0; background: var(--p2); border: 1px solid var(--b2); border-radius: 20px; cursor: pointer; transition: background .2s; }
    .ds-tog input:checked + .ds-tt { background: var(--g); border-color: var(--g); }
    .ds-th { position: absolute; top: 2px; left: 2px; width: 11px; height: 11px; background: #fff; border-radius: 50%; transition: transform .2s; pointer-events: none; z-index: 1; }
    .ds-tog input:checked ~ .ds-th { transform: translateX(15px); }

    /* ── PROGRESS ── */
    .ds-pw { height: 2px; background: var(--p2); border-radius: 2px; overflow: hidden; margin: 9px 0 3px; }
    .ds-pb { height: 100%; background: linear-gradient(90deg,var(--a2),var(--a)); border-radius: 2px; transition: width .6s; }
    .ds-plb { display: flex; justify-content: space-between; font-size: 9px; color: var(--m2); font-family: monospace; }

    /* ── LEADS LIST ── */
    .ds-llist { max-height: 160px; overflow-y: auto; padding: 2px; }
    .ds-llist::-webkit-scrollbar { width: 2px; }
    .ds-llist::-webkit-scrollbar-thumb { background: var(--b2); border-radius: 2px; }
    .ds-lead { display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; border-radius: 7px; border: 1px solid transparent; margin-bottom: 2px; transition: all .2s; }
    .ds-lead:hover { background: var(--p2); border-color: var(--b); }
    .ds-lead.processando { background: rgba(255,171,0,.04); border-color: rgba(255,171,0,.15); }
    .ds-lead.enviado { background: rgba(0,200,83,.04); border-color: rgba(0,200,83,.12); }
    .ds-lead.erro { background: rgba(255,23,68,.04); border-color: rgba(255,23,68,.15); }
    .ds-linfo { flex: 1; min-width: 0; }
    .ds-lh { font-weight: 600; font-size: 12px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ds-lm { font-size: 9px; color: var(--m2); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; }
    .ds-lbtns { display: flex; gap: 3px; flex-shrink: 0; margin-left: 5px; }
    .bx { display: inline-flex; align-items: center; padding: 1px 5px; border-radius: 20px; font-size: 9px; font-weight: 500; text-transform: uppercase; font-family: monospace; }
    .bx-pendente { background: rgba(255,255,255,.05); color: var(--m2); }
    .bx-processando { background: rgba(255,171,0,.12); color: var(--y); }
    .bx-enviado { background: rgba(0,200,83,.12); color: var(--g); }
    .bx-erro { background: rgba(255,23,68,.12); color: var(--r); }

    /* ── AVISO DUPLICATAS ── */
    .ds-dd { font-size: 10px; color: var(--y); background: rgba(255,171,0,.07); border: 1px solid rgba(255,171,0,.2); border-radius: 6px; padding: 5px 9px; margin-bottom: 8px; display: none; font-family: monospace; }
    .ds-dd.show { display: block; }

    /* ── LOG ── */
    .ds-log { background: #04070d; padding: 8px 10px; height: 90px; overflow-y: auto; font-size: 10px; border-radius: 0 0 9px 9px; font-family: monospace; }
    .ds-log::-webkit-scrollbar { width: 2px; }
    .ds-log::-webkit-scrollbar-thumb { background: var(--b2); }
    .ds-le { padding: 1px 0; display: flex; gap: 6px; }
    .ds-lt { color: var(--a2); flex-shrink: 0; }
    .ds-le.ok .ds-lmsg { color: var(--g); } .ds-le.err .ds-lmsg { color: var(--r); } .ds-le.warn .ds-lmsg { color: var(--y); }
    .ds-lmsg { color: var(--m2); }

    /* ── EMPTY ── */
    .ds-empty { text-align: center; padding: 18px; font-size: 11px; color: var(--m); font-family: monospace; }

    /* ── LOGIN ── */
    #ds-login { text-align: center; padding: 6px 0; }
    .ds-ll { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px; }
    .ds-bn { font-size: 17px; font-weight: 700; color: #fff; }
    .ds-bn span { color: var(--a); }
    .ds-tag2 { font-size: 8px; color: var(--m2); letter-spacing: 2px; text-transform: uppercase; font-family: monospace; }
    .ds-sub { font-size: 12px; color: var(--m2); margin-bottom: 16px; line-height: 1.5; }
    .ds-kw { position: relative; margin-bottom: 10px; }
    .ds-kw input { width: 100%; padding: 10px 36px 10px 12px; font-family: monospace; letter-spacing: 2px; font-size: 13px; }
    .ds-eye { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--m2); font-size: 14px; user-select: none; }
    .ds-lerr { font-size: 11px; color: var(--r); background: rgba(255,23,68,.08); border: 1px solid rgba(255,23,68,.2); border-radius: 7px; padding: 6px 10px; margin-bottom: 9px; display: none; font-family: monospace; }
    .ds-linfo2 { font-size: 9px; color: var(--m2); margin-top: 12px; font-family: monospace; }

    /* ── TOAST ── */
    #ds-toast { position: fixed; bottom: 20px; left: 400px; background: var(--p2); border: 1px solid var(--b2); border-radius: 9px; padding: 8px 13px; font-size: 12px; z-index: 2147483647; opacity: 0; transform: translateX(8px); transition: all .2s; pointer-events: none; max-width: 200px; color: var(--t); }
    #ds-toast.show { opacity: 1; transform: translateX(0); }
    #ds-toast.ok { border-color: rgba(0,200,83,.4); color: var(--g); }
    #ds-toast.err { border-color: rgba(255,23,68,.4); color: var(--r); }
    #ds-toast.warn { border-color: rgba(255,171,0,.4); color: var(--y); }

    @keyframes ds-spin { to { transform: rotate(360deg); } }
    .ds-spin { display: inline-block; animation: ds-spin 1s linear infinite; }

    #ds-main { display: none; }
    .ds-sep { height: 1px; background: var(--b); margin: 8px 0; }
  `;
  document.head.appendChild(style);

  // ─── HTML ───────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = 'ds-root';
  root.innerHTML = `
<div id="ds-bar">
  <div class="ds-brand">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M22 2L11 13" stroke="#00e5ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#00e5ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    Direct<span>Speed</span>
  </div>
  <div class="ds-bar-r">
    <span class="ds-mst" id="ds-mst">Parado</span>
    <button class="ds-ib" id="ds-tog" title="Minimizar">—</button>
    <button class="ds-ib" id="ds-out" title="Sair" style="font-size:10px">✕</button>
  </div>
</div>

<div id="ds-body">

  <!-- LOGIN -->
  <div id="ds-login">
    <div class="ds-ll">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="7" fill="#0d1117"/>
        <path d="M20 2L10 12" stroke="#00e5ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20 2L14 20L10 12L2 8L20 2Z" stroke="#00e5ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div>
        <div class="ds-bn">Direct<span>Speed</span></div>
        <div class="ds-tag2">DM Automation</div>
      </div>
    </div>
    <p class="ds-sub">Digite sua chave de acesso.</p>
    <div class="ds-kw">
      <input id="ds-key" type="password" placeholder="DS-XXXX-XXXX-XXXX" maxlength="20"/>
      <span class="ds-eye" id="ds-eye">👁</span>
    </div>
    <div class="ds-lerr" id="ds-lerr"></div>
    <button class="btn btn-cy" id="ds-login-btn" style="width:100%;justify-content:center;padding:10px">Entrar</button>
    <p class="ds-linfo2">Chave fornecida pelo administrador.</p>
  </div>

  <!-- MAIN -->
  <div id="ds-main">

    <!-- Cabeçalho usuário -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.07)">
      <div style="display:flex;align-items:center;gap:7px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#0d1117"/>
          <path d="M20 2L10 12" stroke="#00e5ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M20 2L14 20L10 12L2 8L20 2Z" stroke="#00e5ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <div>
          <div style="font-size:13px;font-weight:700;color:#fff">Direct<span style="color:#00e5ff">Speed</span></div>
          <span id="ds-user" style="font-size:9px;color:#7c3aed;background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.25);border-radius:20px;padding:1px 7px;font-family:monospace">—</span>
        </div>
      </div>
    </div>

    <!-- Status -->
    <div class="ds-sb">
      <span class="ds-st" id="ds-st">Missão parada</span>
      <span class="ds-mb" id="ds-mb">MSG 1</span>
    </div>

    <!-- Stats -->
    <div class="ds-stats">
      <div class="ds-stat"><span class="ds-sv c" id="ds-tc">0</span><span class="ds-sl">Total</span></div>
      <div class="ds-stat"><span class="ds-sv g" id="ds-sc">0</span><span class="ds-sl">Enviados</span></div>
      <div class="ds-stat"><span class="ds-sv r" id="ds-ec">0</span><span class="ds-sl">Erros</span></div>
      <div class="ds-stat"><span class="ds-sv y" id="ds-dc">0</span><span class="ds-sl">Hoje</span></div>
    </div>

    <!-- Mensagens -->
    <div class="ds-card">
      <div class="ds-ch">
        <div class="ds-ct"><div class="ds-dot c"></div> Mensagens</div>
        <div style="display:flex;gap:4px;align-items:center">
          <select id="ds-tpl" style="margin:0;width:100px;padding:3px 6px;font-size:10px"><option value="">— Template —</option></select>
          <button class="btn btn-sm" id="ds-sv-tpl">Salvar</button>
          <button class="btn btn-sm btn-da" id="ds-dl-tpl">✕</button>
        </div>
      </div>
      <div class="ds-cb">
        <label class="lbl">Nome do template</label>
        <input id="ds-tn" type="text" placeholder="Ex: Abordagem inicial"/>
        <label class="lbl">Mensagem 1 — use {user} para mencionar</label>
        <textarea id="ds-m1" rows="3" placeholder="Oii {user}, tudo bem? 😊"></textarea>
        <label class="lbl">Mensagem 2 — alternativa (opcional)</label>
        <textarea id="ds-m2" rows="2" placeholder="Olá {user}! 💗"></textarea>
        <div class="ds-r2">
          <div><label class="lbl">Alternar a cada</label><input id="ds-sw" type="number" value="20" min="1" style="margin-bottom:0"/></div>
          <div style="display:flex;align-items:flex-end"><button class="btn btn-sm btn-fw" id="ds-rc">↺ Zerar</button></div>
        </div>
      </div>
    </div>

    <!-- Leads -->
    <div class="ds-card">
      <div class="ds-ch">
        <div class="ds-ct"><div class="ds-dot p"></div> Leads</div>
        <label style="cursor:pointer" class="btn btn-sm" for="ds-file">↑ .txt
          <input id="ds-file" type="file" accept=".txt" style="display:none">
        </label>
      </div>
      <div class="ds-cb">
        <div class="ds-dd" id="ds-dd"></div>
        <label class="lbl">Lista de @ — um por linha</label>
        <textarea id="ds-li" rows="3" placeholder="@handle1&#10;@handle2"></textarea>
        <div class="ds-cr">
          <button class="btn btn-sm btn-cy" id="ds-load">+ Carregar</button>
          <button class="btn btn-sm btn-da" id="ds-clr">✕ Limpar</button>
        </div>
      </div>
    </div>

    <!-- Configurações -->
    <div class="ds-card">
      <div class="ds-ch"><div class="ds-ct"><div class="ds-dot y"></div> Configurações</div></div>
      <div class="ds-cb">
        <div class="ds-r3">
          <div><label class="lbl">Ordem</label><select id="ds-ord"><option value="sequencial">Sequencial</option><option value="aleatorio">Aleatório</option></select></div>
          <div><label class="lbl">Limite/dia</label><input id="ds-dl" type="number" value="30" min="1"/></div>
          <div><label class="lbl">Delay mín (s)</label><input id="ds-mn" type="number" value="60" min="10"/></div>
        </div>
        <div><label class="lbl">Delay máx (s)</label><input id="ds-mx" type="number" value="180" min="20" style="margin-bottom:7px"/></div>
        <div style="border:1px solid rgba(255,255,255,.07);border-radius:7px;padding:3px 9px">
          <div class="ds-tr">
            <div class="ds-tl">Reinício automático<small>Continua se travar ou der erro</small></div>
            <label class="ds-tog"><input type="checkbox" id="ds-ar"/><div class="ds-tt"></div><div class="ds-th"></div></label>
          </div>
        </div>
        <div class="ds-pw"><div class="ds-pb" id="ds-pb" style="width:0%"></div></div>
        <div class="ds-plb"><span id="ds-pt">0/0</span><span id="ds-pp">0%</span></div>
      </div>
    </div>

    <!-- Controle -->
    <div class="ds-card">
      <div class="ds-ch"><div class="ds-ct"><div class="ds-dot g"></div> Controle</div></div>
      <div class="ds-cb">
        <div class="ds-cr">
          <button class="btn btn-sm" id="ds-pause">⏸ Pausar</button>
          <button class="btn btn-sm btn-da" id="ds-reset">↺ Reset fila</button>
        </div>
        <button class="ds-mbtn" id="ds-start"><span id="ds-si">▶</span><span id="ds-stxt">Iniciar Missão</span></button>
      </div>
    </div>

    <!-- Fila -->
    <div class="ds-card">
      <div class="ds-ch">
        <div class="ds-ct"><div class="ds-dot p"></div> Fila</div>
        <span id="ds-qi" style="font-size:9px;color:#718096;font-family:monospace">0 leads</span>
      </div>
      <div class="ds-llist" id="ds-ll"><div class="ds-empty">Nenhum lead carregado</div></div>
    </div>

    <!-- Log -->
    <div class="ds-card" style="margin-bottom:0">
      <div class="ds-ch">
        <div class="ds-ct"><div class="ds-dot gr"></div> Log</div>
        <button class="btn btn-sm" id="ds-clog">Limpar</button>
      </div>
      <div class="ds-log" id="ds-log"></div>
    </div>

  </div><!-- /ds-main -->
</div><!-- /ds-body -->

<div id="ds-toast"></div>`;

  document.body.appendChild(root);

  // ─── Helpers ────────────────────────────────────────────────
  const $  = id => document.getElementById(id);
  const cU = u  => u.replace('@','').trim().toLowerCase();
  const td = () => new Date().toLocaleDateString('pt-BR');

  function toast(msg, type) {
    const t = $('ds-toast');
    t.textContent = msg;
    t.className = 'show' + (type ? ' '+type : '');
    clearTimeout(t._t);
    t._t = setTimeout(() => t.className = '', 2800);
  }

  async function gL()  { const {ds_leads}        = await chrome.storage.local.get('ds_leads');        return ds_leads        || []; }
  async function sL(l) { await chrome.storage.local.set({ds_leads: l}); }
  async function gH()  { const {ds_sent_history} = await chrome.storage.local.get('ds_sent_history'); return ds_sent_history || {}; }
  async function gT()  { const {ds_templates}    = await chrome.storage.local.get('ds_templates');    return ds_templates    || {}; }

  // ─── Drag ───────────────────────────────────────────────────
  const bar = $('ds-bar');

  bar.addEventListener('mousedown', e => {
    // Não dragar em botões
    if (e.target.closest('.ds-ib')) return;
    isDragging = true;
    const rect = root.getBoundingClientRect();
    dragOffX = e.clientX - rect.left;
    dragOffY = e.clientY - rect.top;
    root.style.transition = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    let x = e.clientX - dragOffX;
    let y = e.clientY - dragOffY;
    // Limita às bordas da janela
    const rw = root.offsetWidth, rh = root.offsetHeight;
    x = Math.max(0, Math.min(window.innerWidth  - rw, x));
    y = Math.max(0, Math.min(window.innerHeight - rh, y));
    root.style.right  = 'auto';
    root.style.bottom = 'auto';
    root.style.left   = x + 'px';
    root.style.top    = y + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      root.style.transition = '';
    }
  });

  // ─── Log ────────────────────────────────────────────────────
  function addLog(time, msg, type) {
    const b = $('ds-log'); if (!b) return;
    const el = document.createElement('div');
    el.className = 'ds-le '+(type||'');
    el.innerHTML = `<span class="ds-lt">[${time}]</span><span class="ds-lmsg">${msg}</span>`;
    b.prepend(el);
  }

  async function loadLogs() {
    const {ds_logs} = await chrome.storage.local.get('ds_logs');
    const b = $('ds-log'); if (!b) return;
    b.innerHTML = '';
    (ds_logs||[]).slice(0,50).forEach(l => addLog(l.time, l.msg, l.type));
  }

  // ─── Status ─────────────────────────────────────────────────
  function setSt(txt) {
    const el = $('ds-st'); if (!el) return;
    el.textContent = txt;
    el.className = 'ds-st';
    let cls = '';
    if (txt.includes('rodando')||txt.includes('Enviando')) cls = 'on';
    else if (txt.includes('Erro')||txt.includes('erro'))   cls = 'e';
    else if (txt.includes('pausada')||txt.includes('atingido')||txt.includes('Aguardando')||txt.includes('Alternando')) cls = 'w';
    if (cls) el.classList.add(cls);

    const mini = $('ds-mst'); if (!mini) return;
    mini.textContent = txt.length > 22 ? txt.substring(0,20)+'…' : txt;
    mini.className = 'ds-mst' + (cls ? ' '+cls : '');
  }

  function setMB(label) { const el = $('ds-mb'); if (el) el.textContent = label||'MSG 1'; }

  // ─── Minimize ───────────────────────────────────────────────
  function togMin() {
    isMinimized = !isMinimized;
    const b = $('ds-body'), btn = $('ds-tog');
    if (isMinimized) {
      b.style.display = 'none';
      root.classList.add('ds-mini');
      btn.textContent = '▲';
      btn.title = 'Expandir';
    } else {
      b.style.display = '';
      root.classList.remove('ds-mini');
      btn.textContent = '—';
      btn.title = 'Minimizar';
    }
  }

  // ─── Login ───────────────────────────────────────────────────
  async function doLogin() {
    const key = ($('ds-key')?.value||'').trim().toUpperCase();
    const btn = $('ds-login-btn'), err = $('ds-lerr');
    if (!key) { if(err){err.textContent='Digite sua chave.';err.style.display='block';} return; }
    btn.disabled = true;
    btn.innerHTML = '<span class="ds-spin">◌</span> Validando...';
    if (err) err.style.display = 'none';
    const r = await chrome.runtime.sendMessage({ type: 'VALIDATE_KEY', key });
    if (r.valid) {
      await chrome.storage.local.set({ ds_auth: { key, user: r.user, validatedAt: Date.now() } });
      showMain(r.user);
    } else {
      if (err) { err.textContent = r.reason||'Chave inválida.'; err.style.display = 'block'; }
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  }

  async function doLogout() {
    await chrome.storage.local.remove('ds_auth');
    $('ds-login').style.display = 'block';
    $('ds-main').style.display  = 'none';
  }

  function showMain(user) {
    $('ds-login').style.display = 'none';
    $('ds-main').style.display  = 'block';
    const u = $('ds-user'); if (u) u.textContent = user||'usuário';
    initMain();
  }

  async function autoLogin() {
    const { ds_auth } = await chrome.storage.local.get('ds_auth');
    if (ds_auth?.key) {
      const r = await chrome.runtime.sendMessage({ type: 'VALIDATE_KEY', key: ds_auth.key });
      if (r.valid) showMain(r.user);
    }
  }

  // ─── Init main ───────────────────────────────────────────────
  async function initMain() {
    await loadLogs();
    await renderAll();
    await renderTpls();
    const { ds_status, ds_msg_counter } = await chrome.storage.local.get(['ds_status','ds_msg_counter']);
    if (ds_status) setSt(ds_status);
    const sw = Number($('ds-sw')?.value)||20;
    setMB(Math.floor((ds_msg_counter||0)/sw)%2===1 ? 'MSG 2' : 'MSG 1');
    const { running } = await chrome.runtime.sendMessage({ type: 'BOT_RUNNING' });
    if (running) setBotUI(true);
  }

  // ─── Polling ────────────────────────────────────────────────
  setInterval(async () => {
    if (!$('ds-main') || $('ds-main').style.display === 'none') return;
    const { ds_status, ds_msg_counter } = await chrome.storage.local.get(['ds_status','ds_msg_counter']);
    if (ds_status) setSt(ds_status);
    const sw = Number($('ds-sw')?.value)||20;
    setMB(Math.floor((ds_msg_counter||0)/sw)%2===1 ? 'MSG 2' : 'MSG 1');
    await renderAll();
  }, 2000);

  // ─── Templates ──────────────────────────────────────────────
  async function renderTpls() {
    const t = await gT(), s = $('ds-tpl'); if (!s) return;
    const cur = s.value;
    s.innerHTML = '<option value="">— Template —</option>';
    Object.keys(t).forEach(n => {
      const o = document.createElement('option');
      o.value = n; o.textContent = n;
      if (n === cur) o.selected = true;
      s.appendChild(o);
    });
  }

  async function saveTpl() {
    const n=$('ds-tn')?.value.trim(), m1=$('ds-m1')?.value.trim(), m2=$('ds-m2')?.value.trim();
    if (!n) return toast('Dê um nome','err');
    const t = await gT(); t[n] = {m1, m2};
    await chrome.storage.local.set({ds_templates: t});
    await renderTpls();
    const s = $('ds-tpl'); if (s) s.value = n;
    toast('Salvo','ok');
  }

  async function loadTpl() {
    const n=$('ds-tpl')?.value; if (!n) return;
    const t=await gT(), tpl=t[n]; if (!tpl) return;
    if($('ds-tn')) $('ds-tn').value=n;
    if (typeof tpl==='string') { if($('ds-m1'))$('ds-m1').value=tpl; if($('ds-m2'))$('ds-m2').value=''; }
    else { if($('ds-m1'))$('ds-m1').value=tpl.m1||''; if($('ds-m2'))$('ds-m2').value=tpl.m2||''; }
  }

  async function delTpl() {
    const n=$('ds-tpl')?.value; if(!n||!confirm('Apagar "'+n+'"?')) return;
    const t=await gT(); delete t[n];
    await chrome.storage.local.set({ds_templates: t}); await renderTpls(); toast('Apagado');
  }

  // ─── Leads ──────────────────────────────────────────────────
  async function loadLeads() {
    const raw=$('ds-li')?.value||'';
    const arr=raw.split('\n').map(i=>i.trim()).filter(Boolean).map(cU);
    if (!arr.length) return toast('Nenhum lead','err');
    const h=await gH(), before=arr.length;
    const dd2=arr.filter(u=>!h[u]), sk=before-dd2.length;
    const uniq=[...new Set(dd2)], id=dd2.length-uniq.length;
    await sL(uniq.map(u=>({username:u,status:'pendente',date:null,sentDate:null,error:null})));
    await renderAll();
    const dd=$('ds-dd');
    if (dd){
      if(sk>0||id>0){
        let m=[]; if(sk>0)m.push(sk+' já enviados'); if(id>0)m.push(id+' duplicatas');
        dd.textContent='⚠ '+m.join(' · '); dd.className='ds-dd show';
      } else dd.className='ds-dd';
    }
    toast(uniq.length+' leads carregados','ok');
  }

  function impFile(e) {
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=ev=>{ if($('ds-li'))$('ds-li').value=ev.target.result; toast('Importado','ok'); };
    r.readAsText(f); e.target.value='';
  }

  async function clearAll() {
    if(!confirm('Apagar todos os leads?')) return;
    await chrome.storage.local.remove('ds_leads');
    const dd=$('ds-dd'); if(dd) dd.className='ds-dd';
    await renderAll();
  }

  async function markSt(username, status) {
    const leads=await gL(), idx=leads.findIndex(l=>l.username===username); if(idx===-1) return;
    leads[idx].status=status; leads[idx].date=new Date().toLocaleString('pt-BR');
    if(status==='enviado'){
      leads[idx].sentDate=td();
      const h=await gH(); h[username]=leads[idx].date;
      await chrome.storage.local.set({ds_sent_history:h});
    }
    await sL(leads); await renderAll();
  }

  const openProf = u => window.open('https://www.instagram.com/'+u+'/','_blank');

  // ─── Render ─────────────────────────────────────────────────
  async function renderAll() {
    const leads=await gL(), total=leads.length;
    const sent=leads.filter(l=>l.status==='enviado').length;
    const err=leads.filter(l=>l.status==='erro').length;
    const dn=leads.filter(l=>l.sentDate===td()).length;
    const set=(id,v)=>{const e=$(id);if(e)e.textContent=v;};
    set('ds-tc',total); set('ds-sc',sent); set('ds-ec',err); set('ds-dc',dn);
    set('ds-qi',total+' leads');
    const pct=total>0?Math.round((sent/total)*100):0;
    const pb=$('ds-pb'); if(pb) pb.style.width=pct+'%';
    set('ds-pt',sent+'/'+total); set('ds-pp',pct+'%');

    const list=$('ds-ll'); if(!list) return;
    list.innerHTML='';
    if(!leads.length){ list.innerHTML='<div class="ds-empty">Nenhum lead carregado</div>'; return; }
    leads.forEach(lead=>{
      const d=document.createElement('div');
      d.className='ds-lead '+lead.status;
      d.innerHTML=`<div class="ds-linfo">
        <div class="ds-lh">@${lead.username}</div>
        <div class="ds-lm"><span class="bx bx-${lead.status}">${lead.status}</span>${lead.date?' '+lead.date:''}${lead.error?' — '+lead.error:''}</div>
      </div>
      <div class="ds-lbtns">
        <button class="btn btn-sm lv" data-u="${lead.username}">↗</button>
        <button class="btn btn-sm btn-su ls" data-u="${lead.username}">✓</button>
        <button class="btn btn-sm btn-da le" data-u="${lead.username}">✕</button>
      </div>`;
      list.appendChild(d);
    });
    list.addEventListener('click', async e=>{
      const u=e.target.getAttribute('data-u'); if(!u) return;
      if(e.target.classList.contains('lv')) openProf(u);
      if(e.target.classList.contains('ls')) await markSt(u,'enviado');
      if(e.target.classList.contains('le')) await markSt(u,'erro');
    });
  }

  // ─── Bot ────────────────────────────────────────────────────
  async function startBot() {
    const m1=$('ds-m1')?.value.trim();
    if (!m1) return toast('Escreva a Mensagem 1','err');
    const leads=await gL();
    if (!leads.some(l=>l.status==='pendente')) return toast('Nenhum lead pendente','err');
    const s={
      message1:m1,
      message2:$('ds-m2')?.value.trim()||'',
      switchEvery:Number($('ds-sw')?.value)||20,
      order:$('ds-ord')?.value||'sequencial',
      dailyLimit:Number($('ds-dl')?.value)||30,
      minDelay:Number($('ds-mn')?.value)||60,
      maxDelay:Number($('ds-mx')?.value)||180,
      autoRestart:$('ds-ar')?.checked||false
    };
    await chrome.runtime.sendMessage({type:'START_BOT', settings:s});
    setBotUI(true); toast('Missão iniciada!','ok');
  }

  async function pauseBot() {
    await chrome.runtime.sendMessage({type:'PAUSE_BOT'});
    setBotUI(false); toast('Pausada','warn');
  }

  async function resetBot() {
    const l=await gL();
    await sL(l.map(x=>({...x,status:'pendente',date:null,sentDate:null,error:null})));
    await renderAll(); toast('Fila resetada','warn');
  }

  function setBotUI(on) {
    const btn=$('ds-start'), icon=$('ds-si'), txt=$('ds-stxt'); if(!btn) return;
    btn.disabled=on; btn.className='ds-mbtn'+(on?' run':'');
    if(icon) icon.innerHTML=on?'<span class="ds-spin">◌</span>':'▶';
    if(txt)  txt.textContent=on?'Em andamento...':'Iniciar Missão';
    if(on) setSt('Missão rodando');
  }

  // ─── Mensagens do background ─────────────────────────────────
  function dsHandleMsg(msg) {
    if (msg.type==='LOG')           addLog(msg.time, msg.msg, msg.logType);
    if (msg.type==='LEADS_UPDATE')  renderAll();
    if (msg.type==='BOT_STATUS')    setBotUI(msg.running);
    if (msg.type==='STATUS_UPDATE') setSt(msg.status);
    if (msg.type==='MSG_ACTIVE')    setMB(msg.label);
  }
  chrome.runtime.onMessage.addListener(dsHandleMsg);

  // ─── Bind events ─────────────────────────────────────────────
  $('ds-tog') ?.addEventListener('click', togMin);
  $('ds-out') ?.addEventListener('click', doLogout);
  $('ds-login-btn')?.addEventListener('click', doLogin);
  $('ds-key') ?.addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
  $('ds-eye') ?.addEventListener('click', ()=>{ const i=$('ds-key'); if(i) i.type=i.type==='password'?'text':'password'; });

  $('ds-tpl')   ?.addEventListener('change', loadTpl);
  $('ds-sv-tpl')?.addEventListener('click', saveTpl);
  $('ds-dl-tpl')?.addEventListener('click', delTpl);

  $('ds-file')?.addEventListener('change', impFile);
  $('ds-load') ?.addEventListener('click', loadLeads);
  $('ds-clr')  ?.addEventListener('click', clearAll);

  $('ds-start')?.addEventListener('click', startBot);
  $('ds-pause')?.addEventListener('click', pauseBot);
  $('ds-reset')?.addEventListener('click', resetBot);
  $('ds-rc')   ?.addEventListener('click', async()=>{
    await chrome.runtime.sendMessage({type:'RESET_MSG_COUNTER'});
    setMB('MSG 1'); toast('Zerado','ok');
  });
  $('ds-clog')?.addEventListener('click', ()=>{ const b=$('ds-log'); if(b) b.innerHTML=''; });

  // ─── Auto-login ──────────────────────────────────────────────
  autoLogin();
  console.log('[DirectSpeed] Painel v3.0 iniciado (somente Disparo)');

})();