import * as db from "../store/database.js";

export function partyBalance(partyId) {
  const party = db.parties.find((p) => p.id === partyId);
  if (!party) return 0;

  let balance = party.openingBalance || 0;

  if (party.type === "customer") {
    db.sales
      .filter((s) => s.partyId === partyId)
      .forEach((s) => (balance += s.total - (s.paid || 0)));
    db.payments
      .filter((p) => p.partyId === partyId && p.type === "in")
      .forEach((p) => (balance -= p.amount));
  } else {
    db.purchases
      .filter((p) => p.partyId === partyId)
      .forEach((p) => (balance += p.total - (p.paid || 0)));
    db.payments
      .filter((p) => p.partyId === partyId && p.type === "out")
      .forEach((p) => (balance -= p.amount));
  }

  return balance;
}

export function totalReceivable() {
  return db.parties
    .filter((p) => p.type === "customer")
    .reduce((sum, p) => sum + Math.max(0, partyBalance(p.id)), 0);
}

export function totalPayable() {
  return db.parties
    .filter((p) => p.type === "supplier")
    .reduce((sum, p) => sum + Math.max(0, partyBalance(p.id)), 0);
}
