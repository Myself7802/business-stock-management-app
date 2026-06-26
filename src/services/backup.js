import * as db from "../store/database.js";
import { replaceDb, saveAll, setMeta } from "../store/database.js";
import { buildBackupPayload } from "./print.js";
import { toast } from "../utils/ui.js";
import { openModal, closeModal } from "../utils/ui.js";
import { refresh } from "../router.js";

let pendingImport = null;

export function renderBackupStatus() {
  const el = document.getElementById("backupStatus");
  if (!el) return;
  const dirty = db.meta.lastChangeAt && (!db.meta.lastBackupAt || db.meta.lastChangeAt > db.meta.lastBackupAt);
  if (!db.meta.lastBackupAt) {
    el.className = "backup-status dirty";
    el.textContent = "No backup yet";
  } else if (dirty) {
    el.className = "backup-status dirty";
    el.textContent = "Unsaved changes";
  } else {
    el.className = "backup-status saved";
    el.textContent = "Backed up";
  }
}

export async function exportBackup() {
  const payload = buildBackupPayload();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  a.download = "stockdesk-backup-" + new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-") + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
  setMeta({ lastBackupAt: Date.now() });
  await saveAll();
  renderBackupStatus();
  toast("Backup downloaded.");
}

export function importBackup(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    let data;
    try {
      data = JSON.parse(e.target.result);
    } catch {
      toast("Invalid backup file.");
      return;
    }
    pendingImport = data;
    document.getElementById("importSummary").innerHTML =
      `Backup from ${data.exportedAt ? new Date(data.exportedAt).toLocaleString("en-IN") : "unknown"}<br>` +
      `Products: <b>${(data.products || []).length}</b>, Parties: <b>${(data.parties || []).length}</b><br>` +
      `Sales: <b>${(data.sales || []).length}</b>, Purchases: <b>${(data.purchases || []).length}</b>`;
    openModal("importOverlay");
  };
  reader.readAsText(file);
}

function mergeArrays(current, incoming, key = "id") {
  const ids = new Set(current.map((x) => x[key]));
  const result = [...current];
  (incoming || []).forEach((item) => {
    if (!ids.has(item[key])) {
      result.push(item);
      ids.add(item[key]);
    }
  });
  return result;
}

export async function applyBackupImport(mode) {
  if (!pendingImport) return;
  if (mode === "replace") {
    replaceDb(pendingImport);
  } else {
    replaceDb({
      products: mergeArrays(db.products, pendingImport.products),
      parties: mergeArrays(db.parties, pendingImport.parties),
      sales: mergeArrays(db.sales, pendingImport.sales),
      purchases: mergeArrays(db.purchases, pendingImport.purchases),
      expenses: mergeArrays(db.expenses, pendingImport.expenses),
      payments: mergeArrays(db.payments, pendingImport.payments),
    });
    toast("Merged new records from backup.");
  }
  pendingImport = null;
  closeModal("importOverlay");
  await saveAll();
  renderBackupStatus();
  toast(mode === "replace" ? "Backup restored (all data replaced)." : "Backup merged.");
  return true;
}

export async function openBackupManager() {
  openModal("backupManagerOverlay");
  await loadBackupList();
}

export async function loadBackupList() {
  const res = await fetch("/api/backups", { cache: "no-store" });
  const payload = await res.json();
  const backups = payload.backups || [];
  const container = document.getElementById("backupList");
  if (!backups.length) {
    container.innerHTML = '<div class="empty">No backups yet. Save any record or click Create Backup Now.</div>';
    return;
  }
  container.innerHTML = backups.map((b) => `
    <div class="backup-row">
      <div>
        <div class="backup-name">${b.name}</div>
        <div class="muted">${new Date(b.modifiedAt).toLocaleString("en-IN")} · ${(b.size / 1024).toFixed(1)} KB</div>
      </div>
      <div class="muted">${b.name.includes("-auto-") ? "Auto backup" : "Manual backup"}</div>
      <div class="actions"><button class="btn-ghost btn-sm" data-action="restore-server-backup" data-name="${b.name}">Restore</button></div>
    </div>
  `).join("");
}

export async function createServerBackup() {
  const res = await fetch("/api/backups/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "manual" }),
  });
  if (!res.ok) {
    toast("Could not create backup.");
    return;
  }
  await loadBackupList();
  toast("Manual backup created.");
}

export async function restoreServerBackup(name) {
  if (!confirm(`Restore backup \"${name}\"? Current data will be replaced.`)) return;
  const res = await fetch("/api/backups/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    toast("Could not restore backup.");
    return;
  }
  const payload = await res.json();
  replaceDb(payload.db);
  refresh();
  await loadBackupList();
  renderBackupStatus();
  toast("Backup restored from local file.");
}

export function getPendingImport() {
  return pendingImport;
}
