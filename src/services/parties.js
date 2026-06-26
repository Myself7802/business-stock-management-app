import * as db from "../store/database.js";
import { inRange } from "../utils/format.js";
import {
  computePartyBalance,
  computeTotalReceivable,
  computeTotalPayable,
} from "../domain/finance.js";

function ledgerContext() {
  return { sales: db.sales, purchases: db.purchases, payments: db.payments };
}

export function partyBalance(partyId) {
  const party = db.parties.find((p) => p.id === partyId);
  return computePartyBalance(party, ledgerContext());
}

/** Green = money in your favour. Red = you need to pay / outgoing. */
export function partyBalanceInfo(partyId) {
  const party = db.parties.find((p) => p.id === partyId);
  const bal = partyBalance(partyId);
  if (!party) return { balance: 0, label: "", cls: "bal-zero", abs: 0 };

  const abs = Math.abs(bal);
  if (party.type === "customer") {
    if (bal > 0) return { balance: bal, label: "Receivable", cls: "bal-receive", abs };
    if (bal < 0) return { balance: bal, label: "Advance (given)", cls: "bal-payable", abs };
    return { balance: 0, label: "Settled", cls: "bal-zero", abs: 0 };
  }
  if (bal > 0) return { balance: bal, label: "Payable", cls: "bal-payable", abs };
  if (bal < 0) return { balance: bal, label: "Advance (paid)", cls: "bal-receive", abs };
  return { balance: 0, label: "Settled", cls: "bal-zero", abs: 0 };
}

export function totalReceivable() {
  return computeTotalReceivable(db.parties, ledgerContext());
}

export function totalPayable() {
  return computeTotalPayable(db.parties, ledgerContext());
}

function itemSummary(items) {
  if (!items?.length) return "";
  const names = items.map((i) => i.name);
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

export function getPartyLedger(partyId, from = "", to = "") {
  const party = db.parties.find((p) => p.id === partyId);
  if (!party) return [];

  const entries = [];
  const dateOk = (date) => inRange(date, from, to);

  if (party.openingBalance) {
    entries.push({
      date: "",
      kind: "opening",
      ref: "\u2014",
      desc: "Opening Balance",
      items: "",
      debit: party.openingBalance > 0 ? party.openingBalance : 0,
      credit: party.openingBalance < 0 ? Math.abs(party.openingBalance) : 0,
      status: "\u2014",
      statusCls: "",
    });
  }

  if (party.type === "customer") {
    db.sales
      .filter((s) => s.partyId === partyId && dateOk(s.date))
      .forEach((s) => {
        const due = s.total - (s.paid || 0);
        const pending = due > 0;
        entries.push({
          date: s.date,
          kind: "sale",
          ref: s.no,
          desc: `Sale #${s.no}`,
          items: itemSummary(s.items),
          debit: s.total,
          credit: s.paid || 0,
          status: pending ? "Pending" : s.payMode === "cash" ? "Cash" : "Paid",
          statusCls: pending ? "status-unpaid" : "status-paid",
        });
      });
    db.payments
      .filter((p) => p.partyId === partyId && p.type === "in" && dateOk(p.date))
      .forEach((p) =>
        entries.push({
          date: p.date,
          kind: "payment",
          recordId: p.id,
          ref: "\u2014",
          desc: "Payment Received",
          items: p.note || "",
          debit: 0,
          credit: p.amount,
          status: "Received",
          statusCls: "status-paid",
        })
      );
  } else {
    db.purchases
      .filter((p) => p.partyId === partyId && dateOk(p.date))
      .forEach((p) => {
        const due = p.total - (p.paid || 0);
        const pending = due > 0;
        entries.push({
          date: p.date,
          kind: "purchase",
          ref: p.no,
          desc: `Purchase #${p.no}`,
          items: itemSummary(p.items),
          debit: p.total,
          credit: p.paid || 0,
          status: pending ? "To Pay" : p.payMode === "cash" ? "Paid" : "Settled",
          statusCls: pending ? "status-unpaid" : "status-paid",
        });
      });
    db.payments
      .filter((p) => p.partyId === partyId && p.type === "out" && dateOk(p.date))
      .forEach((p) =>
        entries.push({
          date: p.date,
          kind: "payment",
          recordId: p.id,
          ref: "\u2014",
          desc: "Payment Made",
          items: p.note || "",
          debit: 0,
          credit: p.amount,
          status: "Paid",
          statusCls: "status-paid",
        })
      );
  }

  entries.sort((a, b) => {
    if (!a.date) return -1;
    if (!b.date) return 1;
    return a.date.localeCompare(b.date);
  });

  let running = 0;
  return entries.map((entry) => {
    if (entry.kind === "opening") {
      running = party.openingBalance || 0;
    } else {
      running += entry.debit - entry.credit;
    }
    return { ...entry, balance: running };
  });
}
