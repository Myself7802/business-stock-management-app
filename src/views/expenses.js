import * as db from "../store/database.js";
import { softDelete, saveAll, setExpenses } from "../store/database.js";
import { esc, money, uid, todayStr, inRange } from "../utils/format.js";
import { openModal, closeModal, toast } from "../utils/ui.js";
import { refresh } from "../router.js";

export function openExpenseForm() {
  document.getElementById("expDate").value = todayStr();
  document.getElementById("expAmount").value = "";
  document.getElementById("expCategory").value = "";
  document.getElementById("expNote").value = "";
  openModal("expenseOverlay");
}

export function saveExpense() {
  const amount = parseFloat(document.getElementById("expAmount").value);
  if (isNaN(amount) || amount <= 0) {
    alert("Enter valid amount.");
    return;
  }

  db.expenses.push({
    id: uid(),
    date: document.getElementById("expDate").value,
    category: document.getElementById("expCategory").value.trim(),
    amount,
    note: document.getElementById("expNote").value.trim(),
  });

  closeModal("expenseOverlay");
  saveAll();
  refresh();
  toast("Expense saved.");
}

export function deleteExpense(id) {
  const expense = db.expenses.find((e) => e.id === id);
  if (!expense || !confirm("Delete expense?")) return;

  softDelete("expense", expense);
  setExpenses(db.expenses.filter((e) => e.id !== id));
  saveAll();
  refresh();
}

export function renderExpenses() {
  const from = document.getElementById("expFrom").value;
  const to = document.getElementById("expTo").value;
  const rows = db.expenses.filter((e) => inRange(e.date, from, to)).slice().reverse();
  const container = document.getElementById("expList");

  if (!rows.length) {
    container.innerHTML = '<div class="empty">No expenses.</div>';
    return;
  }

  let html = `<table><thead><tr><th>Date</th><th>Category</th><th>Amount</th><th>Note</th><th></th></tr></thead><tbody>`;
  rows.forEach((e) => {
    html += `<tr>
      <td>${e.date}</td><td>${esc(e.category) || "—"}</td><td>${money(e.amount)}</td>
      <td class="muted">${esc(e.note) || "—"}</td>
      <td><button class="btn-ghost btn-sm" data-action="delete-expense" data-id="${e.id}">Delete</button></td></tr>`;
  });
  container.innerHTML = html + "</tbody></table>";
}
