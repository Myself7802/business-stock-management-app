import { STORAGE_KEYS } from "../config/constants.js";
import { uid } from "../utils/format.js";

const EMPTY_DB = {
  products: [],
  parties: [],
  sales: [],
  purchases: [],
  expenses: [],
  payments: [],
  trash: [],
  meta: {
    lastBackupAt: null,
    lastChangeAt: null,
    saleNo: 1,
    purchaseNo: 1,
  },
};

function loadLocal(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function cloneEmptyDb() {
  return JSON.parse(JSON.stringify(EMPTY_DB));
}

function normalizeProducts(list) {
  list.forEach((p) => {
    if (p.costPrice == null) p.costPrice = p.price ?? 0;
    if (p.salePrice == null) p.salePrice = p.price ?? 0;
  });
}

function normalizeDb(db) {
  const merged = { ...cloneEmptyDb(), ...db, meta: { ...cloneEmptyDb().meta, ...(db.meta || {}) } };
  normalizeProducts(merged.products);
  return merged;
}

function isEffectivelyEmpty(db) {
  return (
    !db.products.length &&
    !db.parties.length &&
    !db.sales.length &&
    !db.purchases.length &&
    !db.expenses.length &&
    !db.payments.length &&
    !db.trash.length
  );
}

function readLegacyBrowserData() {
  const oldProducts = loadLocal(STORAGE_KEYS.productsV1, null);
  const products = oldProducts && !localStorage.getItem(STORAGE_KEYS.products)
    ? oldProducts.map((p) => ({
        ...p,
        costPrice: p.costPrice ?? p.price ?? 0,
        salePrice: p.salePrice ?? p.price ?? 0,
      }))
    : loadLocal(STORAGE_KEYS.products, []);

  const legacy = {
    products,
    parties: loadLocal(STORAGE_KEYS.parties, []),
    sales: loadLocal(STORAGE_KEYS.sales, []),
    purchases: loadLocal(STORAGE_KEYS.purchases, []),
    expenses: loadLocal(STORAGE_KEYS.expenses, []),
    payments: loadLocal(STORAGE_KEYS.payments, []),
    trash: loadLocal(STORAGE_KEYS.trash, []),
    meta: {
      ...cloneEmptyDb().meta,
      ...loadLocal(STORAGE_KEYS.meta, {}),
    },
  };

  normalizeProducts(legacy.products);
  return legacy;
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
export let meta = cloneEmptyDb().meta;

async function fetchDb() {
  const res = await fetch("/api/db", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load database");
  return normalizeDb(await res.json());
}

async function persistDb(db) {
  const res = await fetch("/api/db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalizeDb(db)),
  });
  if (!res.ok) throw new Error("Failed to save database");
  const payload = await res.json();
  return normalizeDb(payload.db);
}

function applyState(db) {
  products = db.products;
  parties = db.parties;
  sales = db.sales;
  purchases = db.purchases;
  expenses = db.expenses;
  payments = db.payments;
  trash = db.trash;
  meta = db.meta;
}

export async function migrate() {
  let serverDb = await fetchDb();
  if (isEffectivelyEmpty(serverDb)) {
    const legacyDb = normalizeDb(readLegacyBrowserData());
    if (!isEffectivelyEmpty(legacyDb)) {
      serverDb = await persistDb(legacyDb);
    }
  }
  applyState(serverDb);
}

export async function saveAll() {
  meta.lastChangeAt = Date.now();
  const saved = await persistDb({ products, parties, sales, purchases, expenses, payments, trash, meta });
  applyState(saved);
}

export function softDelete(kind, data) {
  trash.push({ id: uid(), kind, data, deletedAt: Date.now() });
}

export function setProducts(list) { products = list; }
export function setParties(list) { parties = list; }
export function setSales(list) { sales = list; }
export function setPurchases(list) { purchases = list; }
export function setExpenses(list) { expenses = list; }
export function setPayments(list) { payments = list; }
export function setTrash(list) { trash = list; }
export function setMeta(next) { meta = { ...meta, ...next }; }
export function nextBillNo(type) { return type === "sale" ? meta.saleNo++ : meta.purchaseNo++; }
export function getDb() { return { products, parties, sales, purchases, expenses, payments, trash, meta }; }

export function replaceDb(data) {
  const next = normalizeDb({
    products: data.products ?? products,
    parties: data.parties ?? parties,
    sales: data.sales ?? sales,
    purchases: data.purchases ?? purchases,
    expenses: data.expenses ?? expenses,
    payments: data.payments ?? payments,
    trash: data.trash ?? trash,
    meta: data.meta ? { ...meta, ...data.meta } : meta,
  });
  applyState(next);
}
