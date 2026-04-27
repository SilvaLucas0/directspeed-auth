// ═══════════════════════════════════════════════════════════
// DirectSpeed — Auth Server
// Valida chaves de acesso da extensão
// Deploy gratuito: https://render.com ou https://railway.app
// ═══════════════════════════════════════════════════════════

const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// ─── BANCO DE CHAVES ────────────────────────────────────────
// Edite aqui para adicionar/remover usuários
// Formato: "CHAVE": { user, expiresAt (null = sem expiração), active }
const KEYS = {
  "DS-ALFA-2024-0001": {
    user: "Lucas Silva",
    expiresAt: null,   // sem expiração
    active: true
  },
  "DS-BETA-2024-0002": {
    user: "Carol",
    expiresAt: "2025-12-31",
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
    active: false  // desabilitada
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

// ─── ROTA: validar chave ─────────────────────────────────────
app.post("/validate", (req, res) => {
  const { key } = req.body;

  if (!key) {
    return res.json({ valid: false, reason: "Chave não fornecida." });
  }

  const entry = KEYS[key.toUpperCase()];

  if (!entry) {
    const result = { valid: false, reason: "Chave inválida." };
    logAccess(key, result);
    return res.json(result);
  }

  if (!entry.active) {
    const result = { valid: false, reason: "Chave desabilitada. Entre em contato com o administrador." };
    logAccess(key, result);
    return res.json(result);
  }

  if (entry.expiresAt) {
    const now = new Date();
    const exp = new Date(entry.expiresAt);
    if (now > exp) {
      const result = { valid: false, user: entry.user, reason: `Chave expirada em ${entry.expiresAt}.` };
      logAccess(key, result);
      return res.json(result);
    }
  }

  const result = {
    valid: true,
    user: entry.user,
    expiresAt: entry.expiresAt || "sem expiração"
  };
  logAccess(key, result);
  res.json(result);
});

// ─── ROTA: status (para verificar se o servidor está no ar) ──
app.get("/", (req, res) => {
  res.json({
    service: "DirectSpeed Auth",
    status: "online",
    keys: Object.keys(KEYS).length,
    uptime: Math.floor(process.uptime()) + "s"
  });
});

// ─── ROTA: log de acessos (protegida por senha admin) ────────
app.get("/admin/log", (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_SECRET && adminKey !== "directspeed-admin") {
    return res.status(401).json({ error: "Não autorizado." });
  }
  res.json({ log: accessLog });
});

// ─── ROTA: listar usuários (protegida) ───────────────────────
app.get("/admin/users", (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_SECRET && adminKey !== "directspeed-admin") {
    return res.status(401).json({ error: "Não autorizado." });
  }
  const users = Object.entries(KEYS).map(([key, v]) => ({
    key: key.substring(0, 8) + "****",
    user: v.user,
    expiresAt: v.expiresAt || "sem expiração",
    active: v.active
  }));
  res.json({ users });
});

// ─── START ───────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`DirectSpeed Auth Server rodando na porta ${PORT}`);
  console.log(`Chaves cadastradas: ${Object.keys(KEYS).length}`);
});
