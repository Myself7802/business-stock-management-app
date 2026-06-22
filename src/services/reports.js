import * as db from "../store/database.js";
import { inRange } from "../utils/format.js";

export function calcProfitLoss(from, to) {
  const filteredSales = db.sales.filter((s) => inRange(s.date, from, to));
  let salesTotal = 0;
  let cogs = 0;
  let gross = 0;

  filteredSales.forEach((sale) => {
    sale.items.forEach((item) => {
      salesTotal += item.qty * item.salePrice;
      cogs += item.qty * item.costPrice;
      gross += item.qty * (item.salePrice - item.costPrice);
    });
  });

  const expenseTotal = db.expenses
    .filter((e) => inRange(e.date, from, to))
    .reduce((sum, e) => sum + e.amount, 0);

  return {
    salesTotal,
    cogs,
    gross,
    expenseTotal,
    net: gross - expenseTotal,
  };
}

export function getPartyStatement(partyId, from, to) {
  const party = db.parties.find((p) => p.id === partyId);
  if (!party) return [];

  const entries = [];

  if (party.type === "customer") {
    db.sales
      .filter((s) => s.partyId === partyId && inRange(s.date, from, to))
      .forEach((s) =>
        entries.push({
          date: s.date,
          desc: `Sale #${s.no}`,
          debit: s.total,
          credit: s.paid || 0,
        })
      );
    db.payments
      .filter((p) => p.partyId === partyId && p.type === "in" && inRange(p.date, from, to))
      .forEach((p) =>
        entries.push({ date: p.date, desc: "Payment In", debit: 0, credit: p.amount })
      );
  } else {
    db.purchases
      .filter((p) => p.partyId === partyId && inRange(p.date, from, to))
      .forEach((p) =>
        entries.push({
          date: p.date,
          desc: `Purchase #${p.no}`,
          debit: p.total,
          credit: p.paid || 0,
        })
      );
    db.payments
      .filter((p) => p.partyId === partyId && p.type === "out" && inRange(p.date, from, to))
      .forEach((p) =>
        entries.push({ date: p.date, desc: "Payment Out", debit: 0, credit: p.amount })
      );
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));

  let runningBalance = party.openingBalance || 0;
  return entries.map((entry) => {
    runningBalance += entry.debit - entry.credit;
    return { ...entry, balance: runningBalance };
  });
}
