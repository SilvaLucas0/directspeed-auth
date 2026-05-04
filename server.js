// ═══════════════════════════════════════════════════════════
// DirectSpeed — Auth Server v2.0
// Valida chaves + Extrator de leads por hashtag/concorrente
// Deploy gratuito: https://render.com ou https://railway.app
// ═══════════════════════════════════════════════════════════

const express = require("express");
const cors    = require("cors");
const app     = express();

app.use(cors());
app.use(express.json());

// ─── BANCO DE CHAVES ────────────────────────────────────────
const KEYS = {
  "DS-ALFA-2024-0001": {
    user: "Lucas Silva",
    expiresAt: null,
    active: true
  },
  "DS-BETA-2024-0002": {
    user: "Neto",
    expiresAt: null,
    active: true
  },
  "DS-GAMA-2024-0003": {
    user: "Júlia",
    expiresAt: "2025-06-30",
    active: true
  },
  "DS-DELT-2024-0004": {
    user: "Fernanda",
    expiresAt: null,
    active: false
  },
  "DS-MAST-9999-ADMIN": {
    user: "Admin",
    expiresAt: null,
    active: true
  }
};

// ─── LOG de acessos ─────────────────────────────────────────
const accessLog = [];

function logAccess(key, result) {
  accessLog.unshift({
    key: key.substring(0, 8) + "****",
    user: result.user || "—",
    valid: result.valid,
    reason: result.reason || "OK",
    time: new Date().toISOString()
  });
  if (accessLog.length > 100) accessLog.pop();
  console.log(`[${new Date().toLocaleString("pt-BR")}] Key: ${key.substring(0,8)}**** | Valid: ${result.valid} | User: ${result.user || "—"}`);
}

// ─── Helper: valida chave internamente ──────────────────────
function checkKey(key) {
  if (!key) return null;
  const entry = KEYS[(key || "").toUpperCase().trim()];
  if (!entry || !entry.active) return null;
  if (entry.expiresAt && new Date() > new Date(entry.expiresAt)) return null;
  return entry;
}

// ─── ROTA: validar chave ─────────────────────────────────────
app.post("/validate", (req, res) => {
  const { key } = req.body;
  if (!key) return res.json({ valid: false, reason: "Chave não fornecida." });

  const entry = KEYS[key.toUpperCase()];
  if (!entry) {
    const result = { valid: false, reason: "Chave inválida." };
    logAccess(key, result); return res.json(result);
  }
  if (!entry.active) {
    const result = { valid: false, reason: "Chave desabilitada. Entre em contato com o administrador." };
    logAccess(key, result); return res.json(result);
  }
  if (entry.expiresAt && new Date() > new Date(entry.expiresAt)) {
    const result = { valid: false, user: entry.user, reason: `Chave expirada em ${entry.expiresAt}.` };
    logAccess(key, result); return res.json(result);
  }

  const result = { valid: true, user: entry.user, expiresAt: entry.expiresAt || "sem expiração" };
  logAccess(key, result);
  res.json(result);
});

// ─── EXTRATOR ───────────────────────────────────────────────
// Sem API externa, sem puppeteer — usa endpoints públicos do Instagram
// mode: "hashtag" | "competitor"
// query: hashtag sem # | @ do concorrente sem @
// minFollowers, maxFollowers, limit

const IG_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/html, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "x-ig-app-id": "936619743392459",
  "Referer": "https://www.instagram.com/",
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Busca dados públicos de um perfil
async function getProfile(username) {
  try {
    const url = `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
    const r = await fetch(url, { headers: IG_HEADERS });
    if (!r.ok) return null;
    const d = await r.json();
    const u = d?.data?.user;
    if (!u) return null;
    return {
      username:   u.username,
      followers:  u.edge_followed_by?.count || 0,
      is_private: u.is_private,
      id:         u.id,
    };
  } catch { return null; }
}

// Extrai autores de posts de uma hashtag
async function extractHashtag(tag, minF, maxF, limit) {
  const results = [], seen = new Set();
  try {
    const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/?__a=1&__d=dis`;
    const r = await fetch(url, { headers: IG_HEADERS });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch {
      const m = text.match(/window\._sharedData\s*=\s*({.+?});<\/script>/);
      if (m) data = JSON.parse(m[1]);
    }
    const edges =
      data?.graphql?.hashtag?.edge_hashtag_to_media?.edges ||
      data?.data?.recent?.sections?.flatMap(s =>
        s.layout_content?.medias?.map(m => ({ node: m.media })) || []
      ) || [];

    for (const edge of edges) {
      if (results.length >= limit) break;
      const node = edge.node || edge;
      const username =
        node?.owner?.username ||
        node?.user?.username ||
        node?.caption?.user?.username;
      if (!username || seen.has(username)) continue;
      seen.add(username);
      const profile = await getProfile(username);
      if (!profile || profile.is_private) continue;
      if (profile.followers < minF || profile.followers > maxF) continue;
      results.push({ username: profile.username, followers: profile.followers });
      await sleep(350);
    }
  } catch (e) {
    console.error("[extractHashtag]", e.message);
  }
  return results;
}

// Extrai seguidores de um concorrente
async function extractCompetitor(competitorUsername, minF, maxF, limit) {
  const results = [], seen = new Set();
  try {
    const profile = await getProfile(competitorUsername);
    if (!profile?.id) throw new Error("Perfil não encontrado: " + competitorUsername);

    let cursor = "", hasNext = true;
    while (results.length < limit && hasNext) {
      const vars = JSON.stringify({ id: profile.id, first: 50, after: cursor });
      const url = `https://www.instagram.com/graphql/query/?query_hash=c76146de99bb02f6415203be841dd25&variables=${encodeURIComponent(vars)}`;
      const r = await fetch(url, { headers: IG_HEADERS });
      if (!r.ok) break;
      const data = await r.json();
      const conn = data?.data?.user?.edge_followed_by;
      if (!conn) break;
      hasNext = conn.page_info?.has_next_page;
      cursor  = conn.page_info?.end_cursor || "";

      for (const edge of (conn.edges || [])) {
        if (results.length >= limit) break;
        const u = edge.node;
        if (!u?.username || seen.has(u.username)) continue;
        seen.add(u.username);
        const fp = await getProfile(u.username);
        if (!fp || fp.is_private) continue;
        if (fp.followers < minF || fp.followers > maxF) continue;
        results.push({ username: fp.username, followers: fp.followers });
        await sleep(400);
      }
      await sleep(900);
    }
  } catch (e) {
    console.error("[extractCompetitor]", e.message);
  }
  return results;
}

app.post("/extract", async (req, res) => {
  const { key, mode, query, minFollowers, maxFollowers, limit } = req.body;

  // Autentica
  const entry = checkKey(key);
  if (!entry) return res.status(401).json({ error: "Não autorizado. Chave inválida ou expirada." });

  if (!mode || !query) return res.status(400).json({ error: "mode e query são obrigatórios." });
  if (!["hashtag","competitor"].includes(mode)) return res.status(400).json({ error: "mode deve ser 'hashtag' ou 'competitor'." });

  const minF = Math.max(0,   parseInt(minFollowers) || 1000);
  const maxF = Math.max(minF, parseInt(maxFollowers) || 500000);
  const lim  = Math.min(200,  Math.max(1, parseInt(limit) || 50));

  console.log(`[extract] user=${entry.user} mode=${mode} query=${query} min=${minF} max=${maxF} limit=${lim}`);

  try {
    let leads = [];
    if (mode === "hashtag") {
      leads = await extractHashtag(query.replace("#","").trim(), minF, maxF, lim);
    } else {
      leads = await extractCompetitor(query.replace("@","").trim(), minF, maxF, lim);
    }
    res.json({ ok: true, count: leads.length, leads });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ROTA: status ────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    service: "DirectSpeed Auth",
    version: "2.0.0",
    status:  "online",
    keys:    Object.keys(KEYS).length,
    uptime:  Math.floor(process.uptime()) + "s"
  });
});

// ─── ROTA: log de acessos ────────────────────────────────────
app.get("/admin/log", (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_SECRET && adminKey !== "lucassilva01") {
    return res.status(401).json({ error: "Não autorizado." });
  }
  res.json({ log: accessLog });
});

// ─── ROTA: listar usuários ───────────────────────────────────
app.get("/admin/users", (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_SECRET && adminKey !== "directspeed-admin") {
    return res.status(401).json({ error: "Não autorizado." });
  }
  const users = Object.entries(KEYS).map(([key, v]) => ({
    key:       key.substring(0, 8) + "****",
    user:      v.user,
    expiresAt: v.expiresAt || "sem expiração",
    active:    v.active
  }));
  res.json({ users });
});

// ─── START ───────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`DirectSpeed Auth Server v2.0 rodando na porta ${PORT}`);
  console.log(`Chaves cadastradas: ${Object.keys(KEYS).length}`);
});
