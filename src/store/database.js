import { STORAGE_KEYS } from "../config/constants.js";
import { uid } from "../utils/format.js";

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

/** @type {import('../types.js').Product[]} */
export let products = [];

/** @type {import('../types.js').Party[]} */
export let parties = [];

/** @type {import('../types.js').Bill[]} */
export let sales = [];

/** @type {import('../types.js').Bill[]} */
export let purchases = [];

/** @type {import('../types.js').Expense[]} */
export let expenses = [];

/** @type {import('../types.js').Payment[]} */
export let payments = [];

/** @type {import('../types.js').TrashItem[]} */
export let trash = [];

/** @type {import('../types.js').Meta} */
export let meta = {
  lastBackupAt: null,
  lastChangeAt: null,
  saleNo: 1,
  purchaseNo: 1,
};

export function migrate() {
  const oldProducts = load(STORAGE_KEYS.productsV1, null);
  if (oldProducts && !localStorage.getItem(STORAGE_KEYS.products)) {
    products = oldProducts.map((p) => ({
      ...p,
      costPrice: p.costPrice ?? p.price ?? 0,
      salePrice: p.salePrice ?? p.price ?? 0,
    }));
  } else {
    products = load(STORAGE_KEYS.products, []);
  }

  parties = load(STORAGE_KEYS.parties, []);
  sales = load(STORAGE_KEYS.sales, []);
  purchases = load(STORAGE_KEYS.purchases, []);
  expenses = load(STORAGE_KEYS.expenses, []);
  payments = load(STORAGE_KEYS.payments, []);
  trash = load(STORAGE_KEYS.trash, []);
  meta = {
    lastBackupAt: null,
    lastChangeAt: null,
    saleNo: 1,
    purchaseNo: 1,
    ...load(STORAGE_KEYS.meta, {}),
  };

  products.forEach((p) => {
    if (p.costPrice == null) p.costPrice = p.price ?? 0;
    if (p.salePrice == null) p.salePrice = p.price ?? 0;
  });
}

export function saveAll() {
  localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(products));
  localStorage.setItem(STORAGE_KEYS.parties, JSON.stringify(parties));
  localStorage.setItem(STORAGE_KEYS.sales, JSON.stringify(sales));
  localStorage.setItem(STORAGE_KEYS.purchases, JSON.stringify(purchases));
  localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(expenses));
  localStorage.setItem(STORAGE_KEYS.payments, JSON.stringify(payments));
  localStorage.setItem(STORAGE_KEYS.trash, JSON.stringify(trash));
  meta.lastChangeAt = Date.now();
  localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify(meta));
}

export function softDelete(kind, data) {
  trash.push({ id: uid(), kind, data, deletedAt: Date.now() });
}

export function setProducts(list) {
  products = list;
}
export function setParties(list) {
  parties = list;
}
export function setSales(list) {
  sales = list;
}
export function setPurchases(list) {
  purchases = list;
}
export function setExpenses(list) {
  expenses = list;
}
export function setPayments(list) {
  payments = list;
}
export function setTrash(list) {
  trash = list;
}
export function setMeta(next) {
  meta = { ...meta, ...next };
}

export function nextBillNo(type) {
  return type === "sale" ? meta.saleNo++ : meta.purchaseNo++;
}

export function getDb() {
  return { products, parties, sales, purchases, expenses, payments, trash, meta };
}

export function replaceDb(data) {
  if (data.products) products = data.products;
  if (data.parties) parties = data.parties;
  if (data.sales) sales = data.sales;
  if (data.purchases) purchases = data.purchases;
  if (data.expenses) expenses = data.expenses;
  if (data.payments) payments = data.payments;
  if (data.trash) trash = data.trash;
  if (data.meta) meta = { ...meta, ...data.meta };
  products.forEach((p) => {
    if (p.costPrice == null) p.costPrice = p.price ?? 0;
    if (p.salePrice == null) p.salePrice = p.price ?? 0;
  });
}
