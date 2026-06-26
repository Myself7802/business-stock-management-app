import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 3210;
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "stockdesk-db.json");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
const MAX_AUTO_BACKUPS = 40;

const defaultDb = () => ({
  products: [],
  parties: [],
  sales: [],
  purchases: [],
  expenses: [],
  payments: [],
  trash: [],
  meta: {
    lastBackupAt: null,
    lastChangeAt: null,
    saleNo: 1,
    purchaseNo: 1,
  },
});

function stampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function ensureDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(defaultDb(), null, 2), "utf8");
  }
}

async function readDb() {
  await ensureDb();
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return { ...defaultDb(), ...parsed, meta: { ...defaultDb().meta, ...(parsed.meta || {}) } };
  } catch {
    const fresh = defaultDb();
    await fs.writeFile(DB_PATH, JSON.stringify(fresh, null, 2), "utf8");
    return fresh;
  }
}

async function listBackups() {
  await ensureDb();
  const entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name.endsWith(".json"));
  const mapped = await Promise.all(
    files.map(async (file) => {
      const fullPath = path.join(BACKUP_DIR, file.name);
      const stat = await fs.stat(fullPath);
      return {
        name: file.name,
        path: fullPath,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      };
    })
  );
  return mapped.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
}

async function createBackupSnapshot(db, reason = "manual") {
  await ensureDb();
  const filename = `stockdesk-${reason}-${stampForFile()}.json`;
  const fullPath = path.join(BACKUP_DIR, filename);
  await fs.writeFile(fullPath, JSON.stringify(db, null, 2), "utf8");
  return fullPath;
}

async function trimAutoBackups() {
  const backups = await listBackups();
  const autoBackups = backups.filter((b) => b.name.includes("-auto-"));
  const stale = autoBackups.slice(MAX_AUTO_BACKUPS);
  await Promise.all(stale.map((b) => fs.unlink(b.path).catch(() => {})));
}

async function writeDb(data) {
  const next = { ...defaultDb(), ...data, meta: { ...defaultDb().meta, ...(data.meta || {}) } };
  await fs.writeFile(DB_PATH, JSON.stringify(next, null, 2), "utf8");
  await createBackupSnapshot(next, "auto");
  await trimAutoBackups();
  return next;
}

app.use(express.json({ limit: "5mb" }));
app.use(express.static(__dirname));

app.get("/api/health", async (_req, res) => {
  await ensureDb();
  res.json({ ok: true, dbPath: DB_PATH, backupDir: BACKUP_DIR });
});

app.get("/api/db", async (_req, res) => {
  const db = await readDb();
  res.json(db);
});

app.post("/api/db", async (req, res) => {
  const saved = await writeDb(req.body || {});
  res.json({ ok: true, db: saved });
});

app.get("/api/backups", async (_req, res) => {
  const backups = await listBackups();
  res.json({ backups });
});

app.post("/api/backups/create", async (req, res) => {
  const db = await readDb();
  const reason = req.body?.reason === "manual" ? "manual" : "manual";
  const fullPath = await createBackupSnapshot(db, reason);
  res.json({ ok: true, path: fullPath });
});

app.post("/api/backups/restore", async (req, res) => {
  const name = req.body?.name;
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
    return res.status(400).json({ ok: false, error: "Invalid backup name" });
  }
  const fullPath = path.join(BACKUP_DIR, name);
  try {
    const raw = await fs.readFile(fullPath, "utf8");
    const parsed = JSON.parse(raw);
    const saved = await writeDb(parsed);
    res.json({ ok: true, db: saved });
  } catch {
    res.status(404).json({ ok: false, error: "Backup file not found or invalid" });
  }
});

app.listen(PORT, () => {
  console.log(`StockDesk server running at http://localhost:${PORT}`);
  console.log(`Database file: ${DB_PATH}`);
  console.log(`Backup folder: ${BACKUP_DIR}`);
});
