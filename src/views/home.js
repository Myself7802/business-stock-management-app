import * as db from "../store/database.js";
import { monthStart, money, todayStr } from "../utils/format.js";
import { calcProfitLoss } from "../services/reports.js";
import { totalReceivable } from "../services/parties.js";

export function renderHome() {
  const today = todayStr();
  const todaySales = db.sales.filter((s) => s.date === today).reduce((sum, s) => sum + s.total, 0);
  const stockValue = db.products.reduce((sum, p) => sum + p.qty * (p.costPrice || 0), 0);
  const pl = calcProfitLoss(monthStart(), today);

  document.getElementById("homeTodaySales").textContent = money(todaySales);
  document.getElementById("homeStockValue").textContent = money(stockValue);
  document.getElementById("homeReceivable").textContent = money(totalReceivable());
  document.getElementById("homeProfit").textContent = money(pl.net);
}
