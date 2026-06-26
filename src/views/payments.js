import * as db from "../store/database.js";
import { softDelete, saveAll, setPayments } from "../store/database.js";
import { partyBalance, partyBalanceInfo } from "../services/parties.js";
import { esc, money, uid, todayStr, inRange } from "../utils/format.js";
import { openModal, closeModal, fillPartySelect, toast, isModalOpen } from "../utils/ui.js";
import { refresh } from "../router.js";

function partyTypeForPayment(type) {
  return type === "in" ? "customer" : "supplier";
}

function balanceInfoForAmount(party, balance) {
  const abs = Math.abs(balance);
  if (party.type === "customer") {
    if (balance > 0) return { label: "Receivable", cls: "bal-receive", abs };
    if (balance < 0) return { label: "Advance (given)", cls: "bal-payable", abs };
    return { label: "Settled", cls: "bal-zero", abs: 0 };
  }
  if (balance > 0) return { label: "Payable", cls: "bal-payable", abs };
  if (balance < 0) return { label: "Advance (paid)", cls: "bal-receive", abs };
  return { label: "Settled", cls: "bal-zero", abs: 0 };
}

function updatePaymentBalancePreview(partyId, draftAmount = null) {
  const box = document.getElementById("payBalancePreview");
  if (!box) return;
  if (!partyId) {
    box.hidden = true;
    return;
  }
  const party = db.parties.find((p) => p.id === partyId);
  if (!party) {
    box.hidden = true;
    return;
  }

  const current = partyBalance(partyId);
  const currentInfo = partyBalanceInfo(partyId);
  const draft = parseFloat(draftAmount);
  const hasDraft = !isNaN(draft) && draft > 0;
  const after = hasDraft ? current - draft : current;
  const afterInfo = balanceInfoForAmount(party, after);

  box.hidden = false;
  box.className = `party-balance-preview ${hasDraft ? afterInfo.cls : currentInfo.cls}`;
  if (hasDraft) {
    box.innerHTML = `
      <span>Current: <b>${money(currentInfo.abs)}</b> ${currentInfo.label}</span>
      <span class="pay-preview-arrow">\u2192</span>
      <span>After payment: <b>${money(afterInfo.abs)}</b> ${afterInfo.label}</span>`;
  } else {
    box.innerHTML = `<span>Current balance</span><b>${money(currentInfo.abs)}</b><span>${currentInfo.label}</span>`;
  }
}

function setPaymentSaveLabel(editing) {
  const btn = document.getElementById("savePaymentBtn");
  if (btn) btn.textContent = editing ? "Update Payment" : "Save Payment";
}

export function openPaymentForm(type, editId = null, options = {}) {
  const payIdEl = document.getElementById("payId");
  const payment = editId ? db.payments.find((p) => p.id === editId) : null;
  if (editId && !payment) return;

  const resolvedType = payment?.type || type;
  const presetPartyId = options.partyId || "";
  payIdEl.value = editId || "";
  document.getElementById("payType").value = resolvedType;

  fillPartySelect("payParty", partyTypeForPayment(resolvedType));

  if (payment) {
    document.getElementById("payModalTitle").textContent =
      resolvedType === "in" ? "Edit Payment In (Received)" : "Edit Payment Out (Paid)";
    document.getElementById("payDate").value = payment.date;
    document.getElementById("payAmount").value = payment.amount;
    document.getElementById("payParty").value = payment.partyId;
    document.getElementById("payMode").value = payment.mode || "Cash";
    document.getElementById("payNote").value = payment.note || "";
    updatePaymentBalancePreview(payment.partyId, payment.amount);
  } else {
    const party = presetPartyId ? db.parties.find((p) => p.id === presetPartyId) : null;
    document.getElementById("payModalTitle").textContent = party
      ? resolvedType === "in"
        ? `Receive Payment  ${party.name}`
        : `Pay Supplier  ${party.name}`
      : resolvedType === "in"
        ? "Payment In (Received)"
        : "Payment Out (Paid)";
    document.getElementById("payDate").value = todayStr();
    document.getElementById("payAmount").value = options.amount || "";
    document.getElementById("payParty").value = presetPartyId;
    document.getElementById("payMode").value = "Cash";
    document.getElementById("payNote").value = "";
    updatePaymentBalancePreview(presetPartyId || null, options.amount || null);
  }

  setPaymentSaveLabel(!!payment);
  openModal("paymentOverlay", { stacked: isModalOpen("partyOverlay") });
  if (!payment && !editId) {
    setTimeout(() => document.getElementById("payAmount")?.focus(), 80);
  }
}

/** Record payment for a party from Parties page (reduces payable / receivable). */
export function openPaymentForParty(partyId) {
  const party = db.parties.find((p) => p.id === partyId);
  if (!party) return;
  const type = party.type === "customer" ? "in" : "out";
  openPaymentForm(type, null, { partyId });
}

export async function savePayment() {
  const editId = document.getElementById("payId").value;
  const type = document.getElementById("payType").value;
  const partyId = document.getElementById("payParty").value;
  const amount = parseFloat(document.getElementById("payAmount").value);
  const date = document.getElementById("payDate").value;
  const mode = document.getElementById("payMode").value;
  const note = document.getElementById("payNote").value.trim();

  if (!partyId) return alert("Select a party.");
  if (!date) return alert("Select a date.");
  if (isNaN(amount) || amount <= 0) return alert("Enter a valid amount greater than zero.");

  const party = db.parties.find((p) => p.id === partyId);
  const expectedType = partyTypeForPayment(type);
  if (!party || party.type !== expectedType) {
    return alert(type === "in" ? "Select a customer for payment in." : "Select a supplier for payment out.");
  }

  if (editId) {
    const payment = db.payments.find((p) => p.id === editId);
    if (!payment) return alert("Payment not found.");
    Object.assign(payment, { date, partyId, amount, mode, note });
    closeModal("paymentOverlay");
    await saveAll();
    refresh();
    toast("Payment updated.");
    return;
  }

  db.payments.push({
    id: uid(),
    date,
    partyId,
    type,
    amount,
    mode,
    note,
    createdAt: Date.now(),
  });
  closeModal("paymentOverlay");
  await saveAll();
  refresh();
  toast("Payment saved.");
}

export async function deletePayment(id) {
  const payment = db.payments.find((p) => p.id === id);
  if (!payment || !confirm("Delete this payment? Party balance will be updated.")) return;
  softDelete("payment", payment);
  setPayments(db.payments.filter((p) => p.id !== id));
  await saveAll();
  refresh();
  toast("Payment deleted.");
}

export function renderPayments() {
  const from = document.getElementById("payFrom").value;
  const to = document.getElementById("payTo").value;
  const rows = db.payments.filter((p) => inRange(p.date, from, to)).slice().reverse();
  const container = document.getElementById("payList");
  if (!rows.length) {
    container.innerHTML = '<div class="empty">No payments.</div>';
    return;
  }
  let html = `<table><thead><tr><th>Date</th><th>Party</th><th>Type</th><th>Amount</th><th>Mode</th><th>Note</th><th></th></tr></thead><tbody>`;
  rows.forEach((payment) => {
    const party = db.parties.find((p) => p.id === payment.partyId);
    html += `<tr>
      <td>${payment.date}</td><td>${esc(party?.name || "\u2014")}</td>
      <td class="${payment.type === "in" ? "pos" : "neg"}">${payment.type === "in" ? "In" : "Out"}</td>
      <td>${money(payment.amount)}</td><td>${esc(payment.mode || "\u2014")}</td>
      <td class="muted">${esc(payment.note) || "\u2014"}</td>
      <td><div class="actions">
        <button class="btn-ghost btn-sm" data-action="edit-payment" data-id="${payment.id}" type="button">Edit</button>
        <button class="btn-ghost btn-sm" data-action="delete-payment" data-id="${payment.id}" type="button">Delete</button>
      </div></td></tr>`;
  });
  container.innerHTML = html + "</tbody></table>";
}

export function setupPaymentsPage() {
  const partySel = document.getElementById("payParty");
  if (partySel && !partySel.dataset.bound) {
    partySel.dataset.bound = "1";
    partySel.addEventListener("change", () => {
      const amount = document.getElementById("payAmount")?.value;
      updatePaymentBalancePreview(partySel.value, amount);
    });
  }
  const amountEl = document.getElementById("payAmount");
  if (amountEl && !amountEl.dataset.bound) {
    amountEl.dataset.bound = "1";
    amountEl.addEventListener("input", () => {
      const partyId = document.getElementById("payParty")?.value;
      updatePaymentBalancePreview(partyId, amountEl.value);
    });
  }
}
