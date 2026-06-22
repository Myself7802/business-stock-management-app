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
  document.querySelectorAll(".overlay").forEach((o) => o.classList.remove("show"));
}

export function openModal(id) {
  document.getElementById(id)?.classList.add("show");
}

export function closeModal(id) {
  document.getElementById(id)?.classList.remove("show");
}

export function setupModalCloseHandlers() {
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.onclick = closeAllModals;
  });
  document.querySelectorAll(".overlay").forEach((overlay) => {
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.classList.remove("show");
    };
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
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
