/**
 * Pure finance rules — single source of truth for bills, balances, and P&L.
 * Used by the app UI and by scripts/test-qa.mjs (no browser required).
 */

export function normalizeBillQty(qty) {
  return Math.max(1, parseInt(qty, 10) || 1);
}

export function normalizeBillItems(items) {
  return (items || []).map((item) => ({
    ...item,
    qty: normalizeBillQty(item.qty),
  }));
}

export function lineUnitPrice(item, billType) {
  return billType === "sale" ? item.salePrice : item.costPrice;
}

export function lineAmount(item, billType) {
  const qty = normalizeBillQty(item.qty);
  return qty * lineUnitPrice(item, billType);
}

export function calcBillTotal(items, billType) {
  return normalizeBillItems(items).reduce(
    (sum, item) => sum + item.qty * lineUnitPrice(item, billType),
    0
  );
}

/** How much is recorded as paid when saving a bill. */
export function resolveBillPaid({ payMode, total, paidInput = 0, creditPaidDraft = 0 }) {
  if (payMode === "cash") return total;
  const paid = Math.max(0, parseFloat(paidInput) || creditPaidDraft || 0);
  return Math.min(paid, total);
}

export function calcDue(total, paid) {
  return Math.max(0, (total || 0) - (paid || 0));
}

export function isBillFullyPaid(total, paid) {
  return calcDue(total, paid) <= 0;
}

/**
 * Simulates Credit → Cash → Credit toggle (the reported purchase bug).
 * Returns paid amount that should be saved.
 */
export function simulateCreditCashCreditSave({
  total,
  creditPaidBeforeCash = 0,
}) {
  let creditPaidDraft = creditPaidBeforeCash;
  // credit → cash: stash draft
  creditPaidDraft = creditPaidBeforeCash;
  // cash → credit: restore draft
  return resolveBillPaid({
    payMode: "credit",
    total,
    paidInput: creditPaidDraft,
    creditPaidDraft,
  });
}

export function computePartyBalance(party, ledger) {
  if (!party) return 0;

  let balance = party.openingBalance || 0;
  const { sales = [], purchases = [], payments = [] } = ledger;
  const partyId = party.id;

  if (party.type === "customer") {
    sales
      .filter((s) => s.partyId === partyId)
      .forEach((s) => {
        balance += s.total - (s.paid || 0);
      });
    payments
      .filter((p) => p.partyId === partyId && p.type === "in")
      .forEach((p) => {
        balance -= p.amount;
      });
  } else {
    purchases
      .filter((p) => p.partyId === partyId)
      .forEach((p) => {
        balance += p.total - (p.paid || 0);
      });
    payments
      .filter((p) => p.partyId === partyId && p.type === "out")
      .forEach((p) => {
        balance -= p.amount;
      });
  }

  return balance;
}

export function computeTotalReceivable(parties, ledger) {
  return parties
    .filter((p) => p.type === "customer")
    .reduce((sum, p) => sum + Math.max(0, computePartyBalance(p, ledger)), 0);
}

export function computeTotalPayable(parties, ledger) {
  return parties
    .filter((p) => p.type === "supplier")
    .reduce((sum, p) => sum + Math.max(0, computePartyBalance(p, ledger)), 0);
}

export function inRange(date, from, to) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function computeProfitLoss({ sales, expenses, from = "", to = "" }) {
  const filteredSales = sales.filter((s) => inRange(s.date, from, to));
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

  const expenseTotal = expenses
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

/** QA checks for a single bill record. Returns list of error strings (empty = OK). */
export function validateBillRecord(bill, billType) {
  const errors = [];
  if (!bill.items?.length) errors.push("no line items");

  const expectedTotal = calcBillTotal(bill.items || [], billType);
  if (bill.total !== expectedTotal) {
    errors.push(`total ${bill.total} != line sum ${expectedTotal}`);
  }

  const paid = bill.paid || 0;
  if (paid < 0) errors.push("paid is negative");
  if (paid > bill.total) errors.push(`paid ${paid} exceeds total ${bill.total}`);

  const due = calcDue(bill.total, paid);
  if (bill.payMode === "cash" && due > 0) {
    errors.push(`cash bill has due ${due}`);
  }
  if (bill.payMode === "cash" && paid !== bill.total) {
    errors.push(`cash bill paid ${paid} != total ${bill.total}`);
  }

  return errors;
}

/** QA checks for payment records. */
export function validatePaymentRecord(payment) {
  const errors = [];
  if (!payment.partyId) errors.push("missing partyId");
  if (!payment.type || !["in", "out"].includes(payment.type)) errors.push("invalid type");
  if (!(payment.amount > 0)) errors.push("amount must be positive");
  return errors;
}
