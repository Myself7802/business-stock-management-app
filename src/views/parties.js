import * as db from "../store/database.js";
import { softDelete, saveAll, setParties } from "../store/database.js";
import { partyBalance } from "../services/parties.js";
import { esc, money, uid } from "../utils/format.js";
import { openModal, closeModal, toast } from "../utils/ui.js";
import { refresh } from "../router.js";

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
  } else {
    ["partyName", "partyPhone", "partyAddress"].forEach((fieldId) => {
      document.getElementById(fieldId).value = "";
    });
    document.getElementById("partyOpening").value = 0;
  }

  openModal("partyOverlay");
}

export function saveParty() {
  const id = document.getElementById("partyId").value;
  const name = document.getElementById("partyName").value.trim();
  if (!name) {
    alert("Enter party name.");
    return;
  }

  const data = {
    name,
    type: document.getElementById("partyType").value,
    phone: document.getElementById("partyPhone").value.trim(),
    address: document.getElementById("partyAddress").value.trim(),
    openingBalance: parseFloat(document.getElementById("partyOpening").value) || 0,
  };

  if (id) {
    Object.assign(db.parties.find((p) => p.id === id), data);
  } else {
    db.parties.push({ id: uid(), ...data });
  }

  closeModal("partyOverlay");
  saveAll();
  refresh();
  toast("Party saved.");
}

export function deleteParty(id) {
  const party = db.parties.find((p) => p.id === id);
  if (!party || !confirm(`Delete "${party.name}"?`)) return;

  softDelete("party", party);
  setParties(db.parties.filter((p) => p.id !== id));
  saveAll();
  refresh();
}

export function renderParties() {
  const container = document.getElementById("partyList");

  if (!db.parties.length) {
    container.innerHTML = '<div class="empty">No parties yet. Add customers and suppliers.</div>';
    syncStatementPartySelect();
    return;
  }

  let html = `<table><thead><tr><th>Name</th><th>Type</th><th>Phone</th><th>Balance</th><th></th></tr></thead><tbody>`;

  db.parties.forEach((party) => {
    const balance = partyBalance(party.id);
    html += `<tr>
      <td><b>${esc(party.name)}</b></td>
      <td>${party.type}</td>
      <td>${esc(party.phone) || "—"}</td>
      <td class="${balance > 0 ? "neg" : "pos"}">${money(balance)} ${party.type === "customer" ? "(due)" : "(pay)"}</td>
      <td><div class="actions">
        <button class="btn-ghost btn-sm" data-action="edit-party" data-id="${party.id}">Edit</button>
        <button class="btn-ghost btn-sm" data-action="delete-party" data-id="${party.id}">Delete</button>
      </div></td></tr>`;
  });

  container.innerHTML = html + "</tbody></table>";
  syncStatementPartySelect();
}

export function syncStatementPartySelect() {
  const select = document.getElementById("stmtParty");
  if (!select) return;
  select.innerHTML = db.parties
    .map((p) => `<option value="${p.id}">${esc(p.name)} (${p.type})</option>`)
    .join("");
}
