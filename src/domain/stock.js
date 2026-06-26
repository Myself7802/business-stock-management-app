/**
 * Pure stock movement rules for sales, purchases, and reversals.
 */

import { normalizeBillItems } from "./finance.js";

export function stockDeltasForBill(billType, items) {
  return normalizeBillItems(items).map((item) => ({
    productId: item.productId,
    delta: billType === "sale" ? -item.qty : item.qty,
  }));
}

export function reverseStockDeltas(billType, items) {
  return stockDeltasForBill(billType, items).map(({ productId, delta }) => ({
    productId,
    delta: -delta,
  }));
}

export function applyStockDeltas(products, deltas) {
  const byId = new Map(products.map((p) => [p.id, { ...p }]));
  deltas.forEach(({ productId, delta }) => {
    const product = byId.get(productId);
    if (product) product.qty += delta;
  });
  return [...byId.values()];
}

/** Rebuild product qty from opening stock + all purchase/sale lines (for integrity checks). */
export function expectedQtyFromBills(productId, { sales = [], purchases = [], openingQty = 0 }) {
  let qty = openingQty;
  purchases.forEach((bill) => {
    bill.items
      .filter((i) => i.productId === productId)
      .forEach((i) => {
        qty += i.qty;
      });
  });
  sales.forEach((bill) => {
    bill.items
      .filter((i) => i.productId === productId)
      .forEach((i) => {
        qty -= i.qty;
      });
  });
  return qty;
}

export function canFulfillSale(product, qtyNeeded) {
  return product.qty >= qtyNeeded;
}
