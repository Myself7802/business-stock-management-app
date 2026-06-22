import * as db from "../store/database.js";
import { saveAll, setTrash } from "../store/database.js";
import { toast } from "../utils/ui.js";

export function restoreFromTrash(trashId) {
  const item = db.trash.find((t) => t.id === trashId);
  if (!item) return;

  const data = item.data;

  switch (item.kind) {
    case "product":
      db.products.push(data);
      break;
    case "party":
      db.parties.push(data);
      break;
    case "sale":
      db.sales.push(data);
      data.items.forEach((line) => {
        const product = db.products.find((p) => p.id === line.productId);
        if (product) product.qty -= line.qty;
      });
      break;
    case "purchase":
      db.purchases.push(data);
      data.items.forEach((line) => {
        const product = db.products.find((p) => p.id === line.productId);
        if (product) product.qty += line.qty;
      });
      break;
    case "expense":
      db.expenses.push(data);
      break;
    case "payment":
      db.payments.push(data);
      break;
  }

  setTrash(db.trash.filter((t) => t.id !== trashId));
  saveAll();
  toast("Restored.");
}

export function purgeFromTrash(trashId) {
  if (!confirm("Delete forever? Cannot undo.")) return;
  setTrash(db.trash.filter((t) => t.id !== trashId));
  saveAll();
}

export function reverseBillStock(bill, type) {
  bill.items.forEach((line) => {
    const product = db.products.find((p) => p.id === line.productId);
    if (!product) return;
    if (type === "sale") product.qty += line.qty;
    else product.qty -= line.qty;
  });
}
