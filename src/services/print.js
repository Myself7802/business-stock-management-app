import { APP_NAME, BACKUP_VERSION } from "../config/constants.js";
import * as db from "../store/database.js";
import { esc, money } from "../utils/format.js";

export function printBill(bill, type) {
  const party = db.parties.find((p) => p.id === bill.partyId);
  const isSale = type === "sale";
  const rows = bill.items
    .map((item) => {
      const price = isSale ? item.salePrice : item.costPrice;
      return `<tr><td>${esc(item.name)}</td><td>${item.qty}</td><td>${money(price)}</td><td>${money(item.qty * price)}</td></tr>`;
    })
    .join("");

  document.getElementById("printArea").innerHTML = `
    <div style="text-align:center"><b>${APP_NAME}</b><br>${isSale ? "SALE" : "PURCHASE"} BILL #${bill.no}<br>${bill.date}</div>
    <hr><b>Party:</b> ${esc(party?.name || bill.partyName || "")}<br><br>
    <table style="width:100%;font-size:10px"><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amt</th></tr>${rows}</table>
    <hr><div style="text-align:right"><b>Total: ${money(bill.total)}</b><br>Paid: ${money(bill.paid || 0)}<br>Due: ${money(bill.total - (bill.paid || 0))}</div>
    ${bill.note ? `<br><small>Note: ${esc(bill.note)}</small>` : ""}`;

  setTimeout(() => window.print(), 300);
}

export function printStatement(party, rows, from, to) {
  let html = `<div style="text-align:center"><b>Party Statement</b><br>${esc(party?.name)}<br>${from} to ${to}</div><hr>
    <table style="width:100%;font-size:10px"><tr><th>Date</th><th>Desc</th><th>Dr</th><th>Cr</th><th>Bal</th></tr>`;

  rows.forEach((row) => {
    html += `<tr><td>${row.date}</td><td>${esc(row.desc)}</td><td>${row.debit || ""}</td><td>${row.credit || ""}</td><td>${row.balance.toFixed(2)}</td></tr>`;
  });

  document.getElementById("printArea").innerHTML = html + "</table>";
  setTimeout(() => window.print(), 200);
}

export function buildBackupPayload() {
  return {
    app: APP_NAME,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    products: db.products,
    parties: db.parties,
    sales: db.sales,
    purchases: db.purchases,
    expenses: db.expenses,
    payments: db.payments,
    trash: db.trash,
    meta: db.meta,
  };
}
