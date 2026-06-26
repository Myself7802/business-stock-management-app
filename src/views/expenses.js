import * as db from "../store/database.js";
import { softDelete, saveAll, setExpenses } from "../store/database.js";
import { esc, money, uid, todayStr, inRange } from "../utils/format.js";
import { openModal, closeModal, toast } from "../utils/ui.js";
import { refresh } from "../router.js";

function setExpenseSaveLabel(editing) {
  const btn = document.getElementById("saveExpenseBtn");
  if (btn) btn.textContent = editing ? "Update Expense" : "Save Expense";
}

export function openExpenseForm(editId = null) {
  const expense = editId ? db.expenses.find((e) => e.id === editId) : null;
  if (editId && !expense) return;

  document.getElementById("expId").value = editId || "";
  if (expense) {
    document.getElementById("expModalTitle").textContent = "Edit Expense";
    document.getElementById("expDate").value = expense.date;
    document.getElementById("expAmount").value = expense.amount;
    document.getElementById("expCategory").value = expense.category || "";
    document.getElementById("expNote").value = expense.note || "";
  } else {
    document.getElementById("expModalTitle").textContent = "Add Expense";
    document.getElementById("expDate").value = todayStr();
    document.getElementById("expAmount").value = "";
    document.getElementById("expCategory").value = "";
    document.getElementById("expNote").value = "";
  }
  setExpenseSaveLabel(!!expense);
  openModal("expenseOverlay");
}

export async function saveExpense() {
  const editId = document.getElementById("expId").value;
  const amount = parseFloat(document.getElementById("expAmount").value);
  const date = document.getElementById("expDate").value;
  const category = document.getElementById("expCategory").value.trim();
  const note = document.getElementById("expNote").value.trim();

  if (!date) return alert("Select a date.");
  if (isNaN(amount) || amount <= 0) return alert("Enter a valid amount greater than zero.");

  if (editId) {
    const expense = db.expenses.find((e) => e.id === editId);
    if (!expense) return alert("Expense not found.");
    Object.assign(expense, { date, category, amount, note });
    closeModal("expenseOverlay");
    await saveAll();
    refresh();
    toast("Expense updated.");
    return;
  }

  db.expenses.push({
    id: uid(),
    date,
    category,
    amount,
    note,
    createdAt: Date.now(),
  });
  closeModal("expenseOverlay");
  await saveAll();
  refresh();
  toast("Expense saved.");
}

export async function deleteExpense(id) {
  const expense = db.expenses.find((e) => e.id === id);
  if (!expense || !confirm("Delete expense?")) return;
  softDelete("expense", expense);
  setExpenses(db.expenses.filter((e) => e.id !== id));
  await saveAll();
  refresh();
  toast("Expense deleted.");
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
      <td>${e.date}</td><td>${esc(e.category) || "\u2014"}</td><td>${money(e.amount)}</td>
      <td class="muted">${esc(e.note) || "\u2014"}</td>
      <td><div class="actions">
        <button class="btn-ghost btn-sm" data-action="edit-expense" data-id="${e.id}" type="button">Edit</button>
        <button class="btn-ghost btn-sm" data-action="delete-expense" data-id="${e.id}" type="button">Delete</button>
      </div></td></tr>`;
  });
  container.innerHTML = html + "</tbody></table>";
}
