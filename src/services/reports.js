import * as db from "../store/database.js";
import { getPartyLedger } from "./parties.js";
import { computeProfitLoss } from "../domain/finance.js";

export function calcProfitLoss(from, to) {
  return computeProfitLoss({
    sales: db.sales,
    expenses: db.expenses,
    from,
    to,
  });
}

export function getPartyStatement(partyId, from, to) {
  return getPartyLedger(partyId, from, to);
}
