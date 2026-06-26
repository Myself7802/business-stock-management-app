import * as db from "../store/database.js";
import { monthStart, todayStr } from "./format.js";

export function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.remove("show"), 2600);
}

export function closeAllModals() {
  document.querySelectorAll(".overlay").forEach((o) => {
    o.classList.remove("show", "front");
    o.style.zIndex = "";
  });
}

export function isModalOpen(id) {
  return document.getElementById(id)?.classList.contains("show");
}

export function openModal(id, { stacked = false } = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  document.querySelectorAll(".overlay.front").forEach((o) => o.classList.remove("front"));
  el.classList.add("show");
  if (stacked) {
    el.classList.add("front");
    const stackDepth = document.querySelectorAll(".overlay.show").length;
    el.style.zIndex = String(50 + stackDepth * 10);
  } else {
    el.style.zIndex = "";
  }
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove("show", "front");
  el.style.zIndex = "";
  const remaining = [...document.querySelectorAll(".overlay.show")];
  if (remaining.length) {
    const top = remaining[remaining.length - 1];
    top.classList.add("front");
    top.style.zIndex = String(50 + remaining.length * 10);
  }
}

export function closeTopModal() {
  const open = [...document.querySelectorAll(".overlay.show")];
  if (!open.length) return;
  const top = open.find((o) => o.classList.contains("front")) || open[open.length - 1];
  closeModal(top.id);
}

export function setupModalCloseHandlers() {
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      const overlay = btn.closest(".overlay");
      if (overlay) closeModal(overlay.id);
      else closeTopModal();
    };
  });
  document.querySelectorAll(".overlay").forEach((overlay) => {
    overlay.onclick = (e) => {
      if (e.target !== overlay) return;
      const open = [...document.querySelectorAll(".overlay.show")];
      if (open.length > 1 && !overlay.classList.contains("front")) return;
      closeModal(overlay.id);
    };
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTopModal();
  });
}

export function fillPartySelect(selectId, partyType) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const list = db.parties.filter((p) => !partyType || p.type === partyType);
  sel.innerHTML =
    '<option value="">— Select —</option>' +
    list.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
}

export function initDateFilters() {
  const ms = monthStart();
  const td = todayStr();
  ["salesFrom", "purchFrom", "expFrom", "payFrom", "repFrom"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = ms;
  });
  ["salesTo", "purchTo", "expTo", "payTo", "repTo"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = td;
  });
}
