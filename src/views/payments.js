import * as db from "../store/database.js";
import { softDelete, saveAll, setPayments } from "../store/database.js";
import { esc, money, uid, todayStr, inRange } from "../utils/format.js";
import { openModal, closeModal, fillPartySelect, toast } from "../utils/ui.js";
import { refresh } from "../router.js";

export function openPaymentForm(type) {
  document.getElementById("payType").value = type;
  document.getElementById("payModalTitle").textContent =
    type === "in" ? "Payment In (Received)" : "Payment Out (Paid)";
  document.getElementById("payDate").value = todayStr();
  document.getElementById("payAmount").value = "";
  document.getElementById("payNote").value = "";
  fillPartySelect("payParty");
  openModal("paymentOverlay");
}

export function savePayment() {
  const type = document.getElementById("payType").value;
  const partyId = document.getElementById("payParty").value;
  const amount = parseFloat(document.getElementById("payAmount").value);

  if (!partyId) {
    alert("Select party.");
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    alert("Enter valid amount.");
    return;
  }

  db.payments.push({
    id: uid(),
    date: document.getElementById("payDate").value,
    partyId,
    type,
    amount,
    mode: document.getElementById("payMode").value,
    note: document.getElementById("payNote").value.trim(),
  });

  closeModal("paymentOverlay");
  saveAll();
  refresh();
  toast("Payment saved.");
}

export function deletePayment(id) {
  const payment = db.payments.find((p) => p.id === id);
  if (!payment || !confirm("Delete payment?")) return;

  softDelete("payment", payment);
  setPayments(db.payments.filter((p) => p.id !== id));
  saveAll();
  refresh();
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

  let html = `<table><thead><tr><th>Date</th><th>Party</th><th>Type</th><th>Amount</th><th>Mode</th><th></th></tr></thead><tbody>`;
  rows.forEach((payment) => {
    const party = db.parties.find((p) => p.id === payment.partyId);
    html += `<tr>
      <td>${payment.date}</td><td>${esc(party?.name || "—")}</td>
      <td class="${payment.type === "in" ? "pos" : "neg"}">${payment.type === "in" ? "In" : "Out"}</td>
      <td>${money(payment.amount)}</td><td>${esc(payment.mode)}</td>
      <td><button class="btn-ghost btn-sm" data-action="delete-payment" data-id="${payment.id}">Delete</button></td></tr>`;
  });
  container.innerHTML = html + "</tbody></table>";
}
