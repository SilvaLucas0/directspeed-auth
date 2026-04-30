// ═══════════════════════════════════════════════════════════
// DirectSpeed — popup.js v2
// ═══════════════════════════════════════════════════════════

let nicheHandles = [];
let extractedHandles = [];
let isMinimized = false;

// ─── Toast ──────────────────────────────────────────────────
function toast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.className = 'toast', 2800);
}

// ─── Utils ──────────────────────────────────────────────────
function cleanU(u) { return u.replace('@','').trim().toLowerCase(); }
function today() { return new Date().toLocaleDateString('pt-BR'); }

async function getLeads() {
  const { ds_leads } = await chrome.storage.local.get('ds_leads');
  return ds_leads || [];
}
async function setLeads(leads) { await chrome.storage.local.set({ ds_leads: leads }); }
async function getHistory() {
  const { ds_sent_history } = await chrome.storage.local.get('ds_sent_history');
  return ds_sent_history || {};
}
async function getTemplates() {
  const { ds_templates } = await chrome.storage.local.get('ds_templates');
  return ds_templates || {};
}

// ─── Log ────────────────────────────────────────────────────
function addLogLine(time, msg, type) {
  const box = document.getElementById('logbox');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'le ' + (type || '');
  el.innerHTML = `<span class="lt">[${time}]</span><span class="lmsg">${msg}</span>`;
  box.prepend(el);
}

function clearLog() { document.getElementById('logbox').innerHTML = ''; }

async function loadLogs() {
  const { ds_logs } = await chrome.storage.local.get('ds_logs');
  const box = document.getElementById('logbox');
  if (!box) return;
  box.innerHTML = '';
  (ds_logs || []).slice(0, 50).forEach(l => addLogLine(l.time, l.msg, l.type));
}

// ─── Status da automação ────────────────────────────────────
function setAutomationStatus(txt) {
  const el = document.getElementById('automationStatus');
  if (!el) return;
  el.textContent = txt;
  // Cor por contexto
  el.className = 'status-bar-txt';
  if (txt.includes('rodando') || txt.includes('Enviando') || txt.includes('Enviado')) el.classList.add('running');
  else if (txt.includes('Erro') || txt.includes('erro')) el.classList.add('err');
  else if (txt.includes('pausada') || txt.includes('atingido') || txt.includes('Alternando') || txt.includes('Aguardando')) el.classList.add('warn');

  // Mini bar
  const mini = document.getElementById('miniStatus');
  if (mini) {
    mini.textContent = txt.length > 24 ? txt.substring(0, 22) + '…' : txt;
    mini.className = 'mini-status' + (txt.includes('rodando') || txt.includes('andamento') ? ' running' : '');
  }
}

function setMsgActiveBadge(label) {
  const el = document.getElementById('msgActiveBadge');
  if (el) el.textContent = label || 'MSG 1';
}

// ─── Online indicator ────────────────────────────────────────
function setOnline(on) {
  const p = document.getElementById('statusPill');
  if (!p) return;
  document.getElementById('statusTxt').textContent = on ? 'Online' : 'Offline';
  p.className = 'status-pill' + (on ? ' online' : '');
}

// ─── Minimize / Expand ──────────────────────────────────────
function minimize() {
  isMinimized = true;
  document.getElementById('screen-main').style.display = 'none';
  document.getElementById('minimizedBar').classList.add('show');
}

function expand() {
  isMinimized = false;
  document.getElementById('screen-main').style.display = 'block';
  document.getElementById('minimizedBar').classList.remove('show');
}

// ─── Tabs ───────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    const names = ['disparo','prospeccao','extrator'];
    t.className = 'tab' + (names[i] === name ? ' active' : '');
  });
  document.querySelectorAll('.tc').forEach(c => {
    c.className = 'tc' + (c.id === 'tc-' + name ? ' active' : '');
  });
}

// ─── LOGIN ──────────────────────────────────────────────────
async function doLogin() {
  const key = document.getElementById('keyInput').value.trim().toUpperCase();
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginError');
  const txt = document.getElementById('loginBtnTxt');
  if (!key) { showLoginError('Digite sua chave de acesso.'); return; }
  btn.disabled = true;
  txt.innerHTML = '<span class="spin">◌</span> Validando...';
  err.style.display = 'none';
  const result = await chrome.runtime.sendMessage({ type: 'VALIDATE_KEY', key });
  if (result.valid) {
    await chrome.storage.local.set({
      ds_auth: { key, user: result.user, expiresAt: result.expiresAt, validatedAt: Date.now() }
    });
    showMain(result.user);
  } else {
    showLoginError(result.reason || 'Chave inválida ou expirada.');
    btn.disabled = false;
    txt.textContent = 'Entrar';
  }
}

function showLoginError(msg) {
  const err = document.getElementById('loginError');
  err.textContent = msg;
  err.style.display = 'block';
}

async function doLogout() {
  await chrome.storage.local.remove('ds_auth');
  document.getElementById('screen-main').classList.remove('active');
  document.getElementById('screen-login').classList.add('active');
  document.getElementById('keyInput').value = '';
}

function showMain(user) {
  document.getElementById('screen-login').classList.remove('active');
  document.getElementById('screen-main').classList.add('active');
  document.getElementById('screen-main').style.display = 'block';
  document.getElementById('userPill').textContent = user || 'usuário';
  init();
}

// ─── INIT ───────────────────────────────────────────────────
async function init() {
  await loadLogs();
  await renderAll();
  await renderTemplates();
  await renderHistory();

  // Carrega status salvo
  const { ds_status } = await chrome.storage.local.get('ds_status');
  if (ds_status) setAutomationStatus(ds_status);

  // Carrega contador de mensagem
  const { ds_msg_counter } = await chrome.storage.local.get('ds_msg_counter');
  const switchEvery = Number(document.getElementById('switchEvery')?.value) || 20;
  const counter = ds_msg_counter || 0;
  const useMsg2 = Math.floor(counter / switchEvery) % 2 === 1;
  setMsgActiveBadge(useMsg2 ? 'MSG 2' : 'MSG 1');

  const { running } = await chrome.runtime.sendMessage({ type: 'BOT_RUNNING' });
  if (running) setBotRunning(true);
}

// ─── TEMPLATES ──────────────────────────────────────────────
async function renderTemplates() {
  const templates = await getTemplates();
  const s = document.getElementById('templateSelect');
  if (!s) return;
  const cur = s.value;
  s.innerHTML = '<option value="">— Template —</option>';
  Object.keys(templates).forEach(n => {
    const o = document.createElement('option');
    o.value = n; o.textContent = n;
    if (n === cur) o.selected = true;
    s.appendChild(o);
  });
}

async function saveTemplate() {
  const n = document.getElementById('templateName').value.trim();
  const m1 = document.getElementById('message1').value.trim();
  const m2 = document.getElementById('message2').value.trim();
  if (!n) return toast('Dê um nome ao template','err');
  const templates = await getTemplates();
  templates[n] = { m1, m2 };
  await chrome.storage.local.set({ ds_templates: templates });
  await renderTemplates();
  document.getElementById('templateSelect').value = n;
  toast('Template salvo','ok');
}

async function loadTemplate() {
  const n = document.getElementById('templateSelect').value;
  if (!n) return;
  const templates = await getTemplates();
  const tpl = templates[n];
  if (!tpl) return;
  document.getElementById('templateName').value = n;
  // Suporte a templates antigos (string) e novos (objeto)
  if (typeof tpl === 'string') {
    document.getElementById('message1').value = tpl;
    document.getElementById('message2').value = '';
  } else {
    document.getElementById('message1').value = tpl.m1 || '';
    document.getElementById('message2').value = tpl.m2 || '';
  }
}

async function deleteTemplate() {
  const n = document.getElementById('templateSelect').value;
  if (!n || !confirm(`Apagar "${n}"?`)) return;
  const templates = await getTemplates();
  delete templates[n];
  await chrome.storage.local.set({ ds_templates: templates });
  await renderTemplates();
  toast('Template apagado');
}

// ─── LEADS ──────────────────────────────────────────────────
async function loadLeads() {
  const raw = document.getElementById('leads').value;
  const arr = raw.split('\n').map(i => i.trim()).filter(i => i.length).map(cleanU);
  if (!arr.length) return toast('Nenhum lead encontrado','err');
  const history = await getHistory();
  const before = arr.length;
  const deduped = arr.filter(u => !history[u]);
  const skipped = before - deduped.length;
  const unique = [...new Set(deduped)];
  const internalDups = deduped.length - unique.length;
  const leads = unique.map(u => ({ username:u, status:'pendente', date:null, sentDate:null, error:null }));
  await setLeads(leads);
  await renderAll();
  const notice = document.getElementById('dedupNotice');
  if (skipped > 0 || internalDups > 0) {
    let msgs = [];
    if (skipped > 0) msgs.push(`${skipped} já enviados removidos`);
    if (internalDups > 0) msgs.push(`${internalDups} duplicatas removidas`);
    notice.textContent = '⚠ ' + msgs.join(' · ');
    notice.className = 'dedup show';
  } else {
    notice.className = 'dedup';
  }
  toast(`${unique.length} leads carregados`,'ok');
}

function importFile(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => { document.getElementById('leads').value = ev.target.result; toast('Arquivo importado','ok'); };
  r.readAsText(f); e.target.value = '';
}

async function clearAll() {
  if (!confirm('Apagar todos os leads?')) return;
  await chrome.storage.local.remove('ds_leads');
  document.getElementById('dedupNotice').className = 'dedup';
  await renderAll();
}

async function exportData() {
  const leads = await getLeads();
  const b = new Blob([JSON.stringify(leads,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(b);
  await chrome.tabs.create({ url });
}

async function markStatus(username, status) {
  const leads = await getLeads();
  const idx = leads.findIndex(l => l.username === username);
  if (idx === -1) return;
  leads[idx].status = status;
  leads[idx].date = new Date().toLocaleString('pt-BR');
  if (status === 'enviado') {
    leads[idx].sentDate = today();
    const history = await getHistory();
    history[username] = leads[idx].date;
    await chrome.storage.local.set({ ds_sent_history: history });
    await renderHistory();
  }
  await setLeads(leads);
  await renderAll();
}

function openProfile(u) { chrome.tabs.create({ url: 'https://www.instagram.com/' + u + '/' }); }

// ─── BOT ────────────────────────────────────────────────────
async function openIG() {
  await chrome.runtime.sendMessage({ type: 'OPEN_INSTAGRAM' });
  setOnline(true);
  toast('Instagram aberto','ok');
}

async function startBot() {
  const msg1 = document.getElementById('message1').value.trim();
  if (!msg1) return toast('Escreva a Mensagem 1 antes de iniciar','err');
  const leads = await getLeads();
  if (!leads.some(l => l.status === 'pendente')) return toast('Nenhum lead pendente','err');

  const settings = {
    message1: msg1,
    message2: document.getElementById('message2').value.trim(),
    switchEvery: Number(document.getElementById('switchEvery').value) || 20,
    order: document.getElementById('orderMode').value,
    dailyLimit: Number(document.getElementById('dailyLimit').value),
    minDelay: Number(document.getElementById('minDelay').value),
    maxDelay: Number(document.getElementById('maxDelay').value),
    autoRestart: document.getElementById('autoRestartToggle').checked
  };

  await chrome.runtime.sendMessage({ type: 'START_BOT', settings });
  setBotRunning(true);
  setOnline(true);
  toast('Missão iniciada!','ok');
}

async function pauseBot() {
  await chrome.runtime.sendMessage({ type: 'PAUSE_BOT' });
  setBotRunning(false);
  setOnline(false);
  toast('Missão pausada','warn');
}

async function resetBot() {
  const leads = await getLeads();
  const reset = leads.map(l => ({...l, status:'pendente', date:null, sentDate:null, error:null}));
  await setLeads(reset);
  await renderAll();
  toast('Fila resetada','warn');
}

async function resetMsgCounter() {
  await chrome.runtime.sendMessage({ type: 'RESET_MSG_COUNTER' });
  setMsgActiveBadge('MSG 1');
  toast('Contador resetado','ok');
}

function setBotRunning(on) {
  const btn = document.getElementById('missionBtn');
  const icon = document.getElementById('missionIcon');
  const txt = document.getElementById('missionTxt');
  if (!btn) return;
  btn.disabled = on;
  btn.className = 'mbtn' + (on ? ' running' : '');
  icon.innerHTML = on ? '<span class="spin">◌</span>' : '▶';
  txt.textContent = on ? 'Em andamento...' : 'Iniciar Missão';
  if (on) setAutomationStatus('Missão rodando');
}

// ─── NICHE ──────────────────────────────────────────────────
function setNiche(q) {
  document.getElementById('nicheQuery').value = q;
  switchTab('prospeccao');
}

async function searchNiche() {
  const query = document.getElementById('nicheQuery').value.trim();
  if (!query) return toast('Digite um nicho','err');
  const btn = document.getElementById('searchBtn');
  const txt = document.getElementById('searchBtnTxt');
  btn.disabled = true;
  txt.innerHTML = '<span class="spin">◌</span>';
  const { handles } = await chrome.runtime.sendMessage({ type: 'SEARCH_NICHE', query, maxResults: 20 });
  nicheHandles = handles || [];
  await renderNicheResults();
  btn.disabled = false;
  txt.textContent = 'Buscar';
  toast(`${nicheHandles.length} perfis encontrados`, nicheHandles.length > 0 ? 'ok' : '');
}

async function renderNicheResults() {
  const history = await getHistory();
  const wrap = document.getElementById('nicheWrap');
  const container = document.getElementById('nicheResults');
  const count = document.getElementById('nicheCount');
  const alreadySent = nicheHandles.filter(h => history[h]).length;
  count.textContent = `${nicheHandles.length} perfis · ${alreadySent} já enviados`;
  wrap.style.display = nicheHandles.length ? 'block' : 'none';
  container.innerHTML = '';
  nicheHandles.forEach(h => {
    const sent = !!history[h];
    const c = document.createElement('div');
    c.className = 'nrc';
    if (sent) c.style.opacity = '.45';
    c.innerHTML = `
      <div class="nrh">@${h}</div>
      <div class="nrm">${sent ? '✓ já enviado' : 'pendente'}</div>
      <div class="nra">
        <button class="btn btn-sm niche-view-btn" data-h="${h}" title="Ver">↗</button>
        ${!sent ? `<button class="btn btn-sm btn-success niche-add-btn" data-h="${h}">+</button>` : ''}
      </div>`;
    container.appendChild(c);
  });
  container.addEventListener('click', async (e) => {
    const h = e.target.getAttribute('data-h');
    if (!h) return;
    if (e.target.classList.contains('niche-view-btn')) { openProfile(h); }
    else if (e.target.classList.contains('niche-add-btn')) {
      const leads = await getLeads();
      if (!leads.find(l => l.username === h)) {
        leads.push({username:h,status:'pendente',date:null,sentDate:null,error:null});
        await setLeads(leads); await renderAll();
        e.target.textContent = '✓'; e.target.disabled = true;
        toast(`@${h} adicionado`,'ok');
      }
    }
  });
}

async function addAllNiche() {
  const leads = await getLeads();
  const history = await getHistory();
  let added = 0;
  nicheHandles.forEach(h => {
    if (!history[h] && !leads.find(l => l.username === h)) {
      leads.push({username:h,status:'pendente',date:null,sentDate:null,error:null});
      added++;
    }
  });
  await setLeads(leads); await renderAll();
  toast(`${added} leads adicionados`,'ok');
  if (added > 0) switchTab('disparo');
}

function clearNiche() {
  nicheHandles = [];
  document.getElementById('nicheWrap').style.display = 'none';
  document.getElementById('nicheResults').innerHTML = '';
}

// ─── VALIDATOR ──────────────────────────────────────────────
async function validateProfile() {
  const input = document.getElementById('validateInput').value.trim();
  if (!input) return toast('Digite um @','err');
  const username = cleanU(input);
  const btn = document.getElementById('valBtn');
  btn.disabled = true; btn.textContent = '...';
  const res = await chrome.runtime.sendMessage({ type: 'VALIDATE_PROFILE', username });
  const el = document.getElementById('valResult');
  el.style.display = 'block';
  if (res.valid) {
    el.style.borderColor = 'rgba(0,200,83,.4)'; el.style.color = 'var(--green)';
    el.textContent = `✓ @${username} — Perfil válido e público`;
  } else {
    el.style.borderColor = 'rgba(255,23,68,.4)'; el.style.color = 'var(--red)';
    el.textContent = `✕ @${username} — ${res.reason}`;
  }
  btn.disabled = false; btn.textContent = 'Validar';
}

// ─── EXTRACTOR ──────────────────────────────────────────────
async function liveExtract() {
  const raw = document.getElementById('rawText').value;
  const minChars = Number(document.getElementById('minChars').value) || 3;
  const excludeRaw = document.getElementById('excludeWords').value;
  const excludeList = excludeRaw.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
  const igBlacklist = ['p','reel','reels','stories','explore','accounts','tv','shop','legal','about','blog','help','contact','hashtag','directory'];
  const atMatches = [...raw.matchAll(/@([a-zA-Z0-9_.]{2,30})/g)].map(m => m[1].toLowerCase());
  const urlMatches = [...raw.matchAll(/instagram\.com\/([a-zA-Z0-9_.]{2,30})\/?(?:\?|$|[^\w])/g)].map(m => m[1].toLowerCase());
  const all = [...new Set([...atMatches, ...urlMatches])]
    .filter(h => h.length >= minChars)
    .filter(h => !igBlacklist.includes(h))
    .filter(h => !excludeList.some(ex => h.includes(ex)));
  extractedHandles = all;
  const ec = document.getElementById('ec');
  const wrap = document.getElementById('extWrap');
  if (!all.length) { ec.style.display='none'; wrap.style.display='none'; return; }
  const history = await getHistory();
  const sentCount = all.filter(h => history[h]).length;
  ec.textContent = all.length + ' @'; ec.style.display = 'block';
  document.getElementById('extInfo').textContent = `${all.length} @ extraídos${sentCount > 0 ? ` · ${sentCount} já enviados` : ''}`;
  wrap.style.display = 'block';
  document.getElementById('extList').innerHTML = all.map(h => {
    const s = !!history[h];
    return `<span style="display:inline-block;margin:1px 4px;color:${s?'var(--muted)':'var(--accent)'};${s?'text-decoration:line-through':''}">@${h}</span>`;
  }).join('');
}

async function sendExtToLeads() {
  if (!extractedHandles.length) return toast('Nenhum @ extraído','err');
  const leads = await getLeads();
  const history = await getHistory();
  let added = 0;
  extractedHandles.filter(h => !history[h]).forEach(h => {
    if (!leads.find(l => l.username === h)) {
      leads.push({username:h,status:'pendente',date:null,sentDate:null,error:null});
      added++;
    }
  });
  await setLeads(leads); await renderAll();
  toast(`${added} leads adicionados`,'ok');
  if (added > 0) switchTab('disparo');
}

function copyExt() {
  navigator.clipboard.writeText(extractedHandles.map(h=>'@'+h).join('\n')).then(() => toast('Copiado!','ok'));
}

function clearExt() {
  document.getElementById('rawText').value = '';
  document.getElementById('ec').style.display = 'none';
  document.getElementById('extWrap').style.display = 'none';
  extractedHandles = [];
}

// ─── HISTORY ────────────────────────────────────────────────
async function renderHistory() {
  const history = await getHistory();
  const el = document.getElementById('histList');
  const keys = Object.keys(history);
  if (!keys.length) { el.innerHTML = '<span style="color:var(--muted)">Nenhum envio registrado.</span>'; return; }
  el.innerHTML = keys.slice(-30).reverse().map(u =>
    `<div style="padding:2px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between">
      <span style="color:var(--accent)">@${u}</span>
      <span style="color:var(--muted)">${history[u]}</span>
    </div>`
  ).join('');
}

async function clearHistory() {
  if (!confirm('Apagar histórico?')) return;
  await chrome.storage.local.remove('ds_sent_history');
  await renderHistory();
  toast('Histórico apagado','warn');
}

// ─── RENDER ─────────────────────────────────────────────────
async function renderAll() {
  const leads = await getLeads();
  const total = leads.length;
  const sent  = leads.filter(l => l.status==='enviado').length;
  const errors= leads.filter(l => l.status==='erro').length;
  const todayN= leads.filter(l => l.sentDate===today()).length;

  document.getElementById('totalCount').textContent  = total;
  document.getElementById('sentCount').textContent   = sent;
  document.getElementById('errorCount').textContent  = errors;
  document.getElementById('todayCount').textContent  = todayN;
  document.getElementById('queueInfo').textContent   = total + ' leads';

  const pct = total > 0 ? Math.round((sent/total)*100) : 0;
  document.getElementById('progressBar').style.width = pct+'%';
  document.getElementById('progressText').textContent= `${sent}/${total}`;
  document.getElementById('progressPct').textContent = pct+'%';

  const list = document.getElementById('list');
  list.innerHTML = '';
  if (!leads.length) { list.innerHTML = '<div class="empty">Nenhum lead carregado</div>'; return; }

  leads.forEach(lead => {
    const d = document.createElement('div');
    d.className = 'lr ' + lead.status;
    d.innerHTML = `
      <div class="li">
        <div class="lh">@${lead.username}</div>
        <div class="lm">
          <span class="badge badge-${lead.status}">${lead.status}</span>
          ${lead.date ? ' '+lead.date : ''}
          ${lead.error ? ' — '+lead.error : ''}
        </div>
      </div>
      <div class="lbtns">
        <button class="btn btn-sm lead-view-btn" data-username="${lead.username}" title="Ver">↗</button>
        <button class="btn btn-sm lead-mark-sent-btn" data-username="${lead.username}" title="OK">✓</button>
        <button class="btn btn-sm btn-danger lead-mark-error-btn" data-username="${lead.username}" title="Erro">✕</button>
      </div>`;
    list.appendChild(d);
  });

  list.addEventListener('click', async (e) => {
    const u = e.target.getAttribute('data-username');
    if (!u) return;
    if (e.target.classList.contains('lead-view-btn')) openProfile(u);
    else if (e.target.classList.contains('lead-mark-sent-btn')) await markStatus(u, 'enviado');
    else if (e.target.classList.contains('lead-mark-error-btn')) await markStatus(u, 'erro');
  });
}

// ─── Mensagens do background ────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'LOG')          addLogLine(msg.time, msg.msg, msg.logType);
  if (msg.type === 'LEADS_UPDATE') renderAll();
  if (msg.type === 'BOT_STATUS')   setBotRunning(msg.running);
  if (msg.type === 'STATUS_UPDATE') setAutomationStatus(msg.status);
  if (msg.type === 'MSG_ACTIVE')   setMsgActiveBadge(msg.label);
});

// ─── DOMContentLoaded ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // LOGIN
  document.getElementById('loginBtn')?.addEventListener('click', doLogin);
  document.getElementById('logoutBtn')?.addEventListener('click', doLogout);
  document.getElementById('eyeBtn')?.addEventListener('click', () => {
    const inp = document.getElementById('keyInput');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
  document.getElementById('keyInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  // MINIMIZE / EXPAND
  document.getElementById('minimizeBtn')?.addEventListener('click', minimize);
  document.getElementById('expandBtn')?.addEventListener('click', expand);

  // TABS
  document.getElementById('tabDisparo')?.addEventListener('click', () => switchTab('disparo'));
  document.getElementById('tabProspeccao')?.addEventListener('click', () => switchTab('prospeccao'));
  document.getElementById('tabExtrator')?.addEventListener('click', () => switchTab('extrator'));

  // TEMPLATES
  document.getElementById('templateSelect')?.addEventListener('change', loadTemplate);
  document.getElementById('saveTemplateBtn')?.addEventListener('click', saveTemplate);
  document.getElementById('deleteTemplateBtn')?.addEventListener('click', deleteTemplate);

  // LEADS
  document.getElementById('fileInput')?.addEventListener('change', importFile);
  document.getElementById('loadLeadsBtn')?.addEventListener('click', loadLeads);
  document.getElementById('clearAllBtn')?.addEventListener('click', clearAll);
  document.getElementById('exportDataBtn')?.addEventListener('click', exportData);

  // BOT
  document.getElementById('statusPill')?.addEventListener('click', openIG);
  document.getElementById('openIGBtn')?.addEventListener('click', openIG);
  document.getElementById('pauseBotBtn')?.addEventListener('click', pauseBot);
  document.getElementById('resetBotBtn')?.addEventListener('click', resetBot);
  document.getElementById('missionBtn')?.addEventListener('click', startBot);
  document.getElementById('resetCounterBtn')?.addEventListener('click', resetMsgCounter);

  // LOG
  document.getElementById('clearLogBtn')?.addEventListener('click', clearLog);

  // NICHE
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => setNiche(chip.getAttribute('data-niche')));
  });
  document.getElementById('searchBtn')?.addEventListener('click', searchNiche);
  document.getElementById('addAllNicheBtn')?.addEventListener('click', addAllNiche);
  document.getElementById('clearNicheBtn')?.addEventListener('click', clearNiche);

  // VALIDATOR
  document.getElementById('valBtn')?.addEventListener('click', validateProfile);

  // EXTRACTOR
  document.getElementById('rawText')?.addEventListener('input', liveExtract);
  document.getElementById('sendExtToLeadsBtn')?.addEventListener('click', sendExtToLeads);
  document.getElementById('copyExtBtn')?.addEventListener('click', copyExt);
  document.getElementById('clearExtBtn')?.addEventListener('click', clearExt);
  document.getElementById('applyFiltersBtn')?.addEventListener('click', liveExtract);

  // HISTORY
  document.getElementById('clearHistoryBtn')?.addEventListener('click', clearHistory);
});

// ─── Auto-login ──────────────────────────────────────────────
chrome.storage.local.get('ds_auth', ({ ds_auth }) => {
  if (ds_auth?.key) {
    chrome.runtime.sendMessage({ type: 'VALIDATE_KEY', key: ds_auth.key }).then(result => {
      if (result.valid) showMain(result.user);
      else chrome.storage.local.remove('ds_auth');
    });
  }
});
