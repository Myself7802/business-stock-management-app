import { CURRENCY } from "../config/constants.js";

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function money(n) {
  return CURRENCY + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function inRange(date, from, to) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function escCsv(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export function downloadBlob(content, filename, mime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
