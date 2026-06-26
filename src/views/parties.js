import * as db from "../store/database.js";
import { softDelete, saveAll, setParties } from "../store/database.js";
import { partyBalanceInfo, getPartyLedger } from "../services/parties.js";
import { esc, money, uid } from "../utils/format.js";
import { openModal, closeModal, toast, isModalOpen } from "../utils/ui.js";
import { refresh } from "../router.js";

let selectedPartyId = null;

const EM_DASH = "\u2014";

function formatDisplayDate(iso) {
  if (!iso) return EM_DASH;
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function updateOpeningHint() {
  const type = document.getElementById("partyType")?.value;
  const hint = document.getElementById("partyOpeningHint");
  if (!hint) return;
  hint.textContent =
    type === "customer"
      ? "Positive = customer owes you (receivable). Negative = you took advance from them."
      : "Positive = you owe supplier (payable). Negative = you paid advance to supplier.";
}

function updatePartyBalancePreview(id) {
  const box = document.getElementById("partyBalancePreview");
  if (!box) return;
  if (!id) {
    box.hidden = true;
    return;
  }
  const info = partyBalanceInfo(id);
  box.hidden = false;
  box.className = `party-balance-preview ${info.cls}`;
  box.innerHTML = `<span>Current Balance</span><b>${money(info.abs)}</b><span>${info.label}</span>`;
}

export function selectPartyView(id) {
  selectedPartyId = id;
  renderParties();
}

export function openPartyForm(id) {
  document.getElementById("partyModalTitle").textContent = id ? "Edit Party" : "Add Party";
  document.getElementById("partyId").value = id || "";
  if (id) {
    const party = db.parties.find((p) => p.id === id);
    document.getElementById("partyName").value = party.name;
    document.getElementById("partyType").value = party.type;
    document.getElementById("partyPhone").value = party.phone || "";
    document.getElementById("partyAddress").value = party.address || "";
    document.getElementById("partyOpening").value = party.openingBalance || 0;
    updatePartyBalancePreview(id);
  } else {
    ["partyName", "partyPhone", "partyAddress"].forEach((fieldId) => {
      document.getElementById(fieldId).value = "";
    });
    document.getElementById("partyOpening").value = 0;
    updatePartyBalancePreview(null);
  }
  updateOpeningHint();
  const callout = document.getElementById("partyPaymentCallout");
  if (callout) {
    callout.hidden = !id;
    const party = id ? db.parties.find((p) => p.id === id) : null;
    const btn = callout.querySelector("[data-action='party-record-payment']");
    if (btn && party) {
      btn.dataset.id = party.id;
      btn.textContent = party.type === "customer" ? "Receive Payment" : "Pay Supplier";
      btn.className = party.type === "customer" ? "btn-green btn-sm" : "btn-red btn-sm";
    }
  }
  openModal("partyOverlay", { stacked: isModalOpen("billOverlay") });
}

export async function saveParty() {
  const id = document.getElementById("partyId").value;
  const name = document.getElementById("partyName").value.trim();
  if (!name) return alert("Enter party name.");
  const data = {
    name,
    type: document.getElementById("partyType").value,
    phone: document.getElementById("partyPhone").value.trim(),
    address: document.getElementById("partyAddress").value.trim(),
    openingBalance: parseFloat(document.getElementById("partyOpening").value) || 0,
  };
  if (id) Object.assign(db.parties.find((p) => p.id === id), data);
  else {
    const newId = uid();
    db.parties.push({ id: newId, ...data });
    selectedPartyId = newId;
  }
  closeModal("partyOverlay");
  await saveAll();
  refresh();
  toast("Party saved.");
}

export async function deleteParty(id) {
  const party = db.parties.find((p) => p.id === id);
  if (!party || !confirm(`Delete "${party.name}"?`)) return;
  softDelete("party", party);
  setParties(db.parties.filter((p) => p.id !== id));
  if (selectedPartyId === id) selectedPartyId = null;
  await saveAll();
  refresh();
  toast("Moved to trash.");
}

function filterParties() {
  const q = (document.getElementById("partySearch")?.value || "").trim().toLowerCase();
  const filter = document.getElementById("partyFilter")?.value || "all";
  return db.parties.filter((p) => {
    const matchQ = !q || p.name.toLowerCase().includes(q) || (p.phone || "").includes(q);
    const matchF = filter === "all" || p.type === filter;
    return matchQ && matchF;
  });
}

function kindLabel(kind) {
  if (kind === "sale") return "Sale";
  if (kind === "purchase") return "Purchase";
  if (kind === "payment") return "Payment";
  if (kind === "opening") return "Opening";
  return kind;
}

function kindDotClass(kind) {
  if (kind === "sale") return "dot-sale";
  if (kind === "purchase") return "dot-purchase";
  if (kind === "payment") return "dot-payment";
  return "dot-neutral";
}

function renderPartyDetail(party) {
  const container = document.getElementById("partyDetail");
  const info = partyBalanceInfo(party.id);
  const ledger = getPartyLedger(party.id);

  let txHtml = "";
  if (!ledger.length) {
    txHtml = '<div class="products-tx-empty">No transactions yet.</div>';
  } else {
    txHtml = `<table class="products-tx-table party-ledger-table"><thead><tr>
      <th class="col-dot"></th><th>Type</th><th>Ref #</th><th>Description</th><th>Items</th><th>Date</th>
      <th class="col-num">Debit</th><th class="col-num">Credit</th><th class="col-num">Balance</th><th>Status</th><th></th>
    </tr></thead><tbody>`;
    ledger.forEach((row) => {
      const balCls = row.balance > 0 ? (party.type === "customer" ? "bal-receive" : "bal-payable") : row.balance < 0 ? "bal-payable" : "bal-zero";
      const actionCell =
        row.kind === "payment" && row.recordId
          ? `<button class="btn-ghost btn-sm" data-action="edit-payment" data-id="${row.recordId}" type="button">Edit</button>`
          : "";
      txHtml += `<tr>
        <td class="col-dot"><span class="tx-dot ${kindDotClass(row.kind)}"></span></td>
        <td>${kindLabel(row.kind)}</td>
        <td><b>${row.ref}</b></td>
        <td>${esc(row.desc)}</td>
        <td class="party-items-cell">${esc(row.items) || EM_DASH}</td>
        <td>${formatDisplayDate(row.date)}</td>
        <td class="col-num">${row.debit ? money(row.debit) : EM_DASH}</td>
        <td class="col-num">${row.credit ? money(row.credit) : EM_DASH}</td>
        <td class="col-num ${balCls}">${money(row.balance)}</td>
        <td>${row.statusCls ? `<span class="tx-status ${row.statusCls}">${row.status}</span>` : row.status}</td>
        <td>${actionCell}</td>
      </tr>`;
    });
    txHtml += "</tbody></table>";
  }

  container.innerHTML = `
    <div class="products-detail-inner">
      <div class="products-detail-top">
        <div class="products-detail-title">
          <h2>${esc(party.name)}</h2>
          <span class="party-type-pill ${party.type}">${party.type === "customer" ? "Customer" : "Supplier"}</span>
        </div>
        <div class="prod-detail-actions">
          ${
            party.type === "customer"
              ? `<button class="btn-green btn-sm" data-action="party-record-payment" data-id="${party.id}" type="button">Receive Payment</button>`
              : `<button class="btn-red btn-sm" data-action="party-record-payment" data-id="${party.id}" type="button">Pay Supplier</button>`
          }
          <button class="btn-primary btn-sm" data-action="edit-party" data-id="${party.id}" type="button">Edit Party</button>
          <button class="btn-ghost btn-sm" data-action="delete-party" data-id="${party.id}" type="button">Delete</button>
        </div>
      </div>
      <div class="products-kpi-row party-kpi-row">
        <div class="products-kpi">
          <div class="kpi-label">Phone</div>
          <div class="kpi-value kpi-small">${esc(party.phone) || EM_DASH}</div>
        </div>
        <div class="products-kpi">
          <div class="kpi-label">Opening Balance</div>
          <div class="kpi-value kpi-small">${money(party.openingBalance || 0)}</div>
        </div>
        <div class="products-kpi">
          <div class="kpi-label">Current Balance</div>
          <div class="kpi-value kpi-small ${info.cls}">${money(info.abs)}</div>
        </div>
        <div class="products-kpi">
          <div class="kpi-label">Status</div>
          <div class="kpi-value kpi-small ${info.cls}">${info.label}</div>
        </div>
      </div>
      <div class="field party-address-box"><label>Address</label><p>${esc(party.address) || EM_DASH}</p></div>
      <div class="products-tx-section">
        <div class="products-tx-head">
          <h3>Transaction History</h3>
          <span class="muted">${ledger.length} entries</span>
        </div>
        <div class="products-tx-table-wrap">${txHtml}</div>
      </div>
    </div>`;
}

function renderEmptyPartyDetail(msg) {
  document.getElementById("partyDetail").innerHTML = `
    <div class="products-empty-state">
      <div class="products-empty-icon" aria-hidden="true"></div>
      <p>${msg}</p>
    </div>`;
}

export function renderParties() {
  const rows = filterParties();
  if (!selectedPartyId || !db.parties.find((p) => p.id === selectedPartyId)) {
    selectedPartyId = rows[0]?.id || null;
  }

  const countEl = document.getElementById("partyCount");
  if (countEl) countEl.textContent = rows.length + " parties";

  const sidebar = document.getElementById("partySidebarList");
  if (!sidebar) return;

  if (!rows.length) {
    sidebar.innerHTML = '<div class="products-list-empty">No parties found.</div>';
    renderEmptyPartyDetail("Add a customer or supplier to get started.");
    syncStatementPartySelect();
    return;
  }

  let html = "";
  rows.forEach((party) => {
    const info = partyBalanceInfo(party.id);
    const active = party.id === selectedPartyId ? " active" : "";
    html += `<button type="button" class="products-list-item parties-list-item${active}" data-action="select-party-view" data-id="${party.id}">
      <span class="products-list-name">
        <span class="party-type-tag ${party.type}">${party.type === "customer" ? "C" : "S"}</span>
        ${esc(party.name)}
      </span>
      <span class="products-list-qty ${info.cls}">${money(info.abs)}</span>
    </button>`;
  });
  sidebar.innerHTML = html;

  const selected = db.parties.find((p) => p.id === selectedPartyId);
  if (selected) renderPartyDetail(selected);
  else renderEmptyPartyDetail("Select a party from the list to view balance and full transaction history.");

  syncStatementPartySelect();
}

export function setupPartiesPage() {
  const search = document.getElementById("partySearch");
  const filter = document.getElementById("partyFilter");
  if (search && !search.dataset.bound) {
    search.dataset.bound = "1";
    search.addEventListener("input", renderParties);
  }
  if (filter && !filter.dataset.bound) {
    filter.dataset.bound = "1";
    filter.addEventListener("change", renderParties);
  }
  const typeEl = document.getElementById("partyType");
  if (typeEl && !typeEl.dataset.bound) {
    typeEl.dataset.bound = "1";
    typeEl.addEventListener("change", updateOpeningHint);
  }
}

export function syncStatementPartySelect() {
  const select = document.getElementById("stmtParty");
  if (!select) return;
  select.innerHTML = db.parties.map((p) => `<option value="${p.id}">${esc(p.name)} (${p.type})</option>`).join("");
}
