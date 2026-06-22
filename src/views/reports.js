import * as db from "../store/database.js";
import { calcProfitLoss, getPartyStatement } from "../services/reports.js";
import { printStatement } from "../services/print.js";
import { esc, money, escCsv, downloadBlob, todayStr } from "../utils/format.js";
import { toast } from "../utils/ui.js";
import { getActiveReport, setActiveReport } from "../router.js";

export function renderReports() {
  const from = document.getElementById("repFrom").value;
  const to = document.getElementById("repTo").value;
  const reportType = getActiveReport();

  if (reportType === "pl") {
    document.getElementById("reportPL").hidden = false;
    document.getElementById("reportParty").hidden = true;
    renderProfitLoss(from, to);
  } else {
    document.getElementById("reportPL").hidden = true;
    document.getElementById("reportParty").hidden = false;
    renderPartyStatement(from, to);
  }
}

function renderProfitLoss(from, to) {
  const pl = calcProfitLoss(from, to);
  document.getElementById("reportPL").innerHTML = `
    <div class="card">
      <div class="card-head"><h2>Profit / Loss Report</h2><span class="muted">${from || "start"} to ${to || "today"}</span></div>
      <div style="padding:16px;font-size:14px;line-height:2">
        <div>Sales Total: <b>${money(pl.salesTotal)}</b></div>
        <div>Cost of Goods (COGS): <b>${money(pl.cogs)}</b></div>
        <div>Gross Profit: <b class="pos">${money(pl.gross)}</b></div>
        <div>Expenses: <b class="neg">${money(pl.expenseTotal)}</b></div>
        <hr style="border:none;border-top:1px solid var(--border)">
        <div style="font-size:18px">Net Profit / Loss: <b class="${pl.net >= 0 ? "pos" : "neg"}">${money(pl.net)}</b></div>
      </div>
    </div>`;
}

export function renderPartyStatement(from, to) {
  const partyId = document.getElementById("stmtParty").value;
  const party = db.parties.find((p) => p.id === partyId);
  const rows = getPartyStatement(partyId, from, to);
  const container = document.getElementById("stmtContent");

  if (!party) {
    container.innerHTML = '<div class="empty">Select a party.</div>';
    return;
  }
  if (!rows.length) {
    container.innerHTML = '<div class="empty">No transactions in range.</div>';
    return;
  }

  let html = `<div style="padding:14px"><b>${esc(party.name)}</b> — ${party.type}<br><span class="muted">${from || "start"} to ${to || "today"}</span></div>
    <table><thead><tr><th>Date</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead><tbody>`;

  rows.forEach((row) => {
    html += `<tr>
      <td>${row.date}</td><td>${esc(row.desc)}</td>
      <td>${row.debit ? money(row.debit) : "—"}</td>
      <td>${row.credit ? money(row.credit) : "—"}</td>
      <td>${money(row.balance)}</td></tr>`;
  });

  container.innerHTML = html + "</tbody></table>";
}

export function exportStatementCsv() {
  const partyId = document.getElementById("stmtParty").value;
  const party = db.parties.find((p) => p.id === partyId);
  const from = document.getElementById("repFrom").value;
  const to = document.getElementById("repTo").value;
  const rows = getPartyStatement(partyId, from, to);

  if (!rows.length) {
    toast("No data.");
    return;
  }

  const lines = [["Date", "Description", "Debit", "Credit", "Balance"].join(",")];
  rows.forEach((row) => {
    lines.push([row.date, row.desc, row.debit, row.credit, row.balance].map(escCsv).join(","));
  });

  downloadBlob(
    "\uFEFF" + lines.join("\n"),
    `statement-${party?.name || "party"}-${todayStr()}.csv`,
    "text/csv;charset=utf-8"
  );
  toast("Statement exported to CSV.");
}

export function printPartyStatement() {
  const partyId = document.getElementById("stmtParty").value;
  const party = db.parties.find((p) => p.id === partyId);
  const from = document.getElementById("repFrom").value;
  const to = document.getElementById("repTo").value;
  const rows = getPartyStatement(partyId, from, to);
  printStatement(party, rows, from, to);
}

export function switchReportTab(report) {
  setActiveReport(report);
  document.querySelectorAll(".report-tab").forEach((tab) =>
    tab.classList.toggle("active", tab.dataset.report === report)
  );
  renderReports();
}
