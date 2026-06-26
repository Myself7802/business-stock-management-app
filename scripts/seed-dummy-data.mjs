/**
 * Seeds StockDesk with sample products, parties, bills, etc.
 * Run: node scripts/seed-dummy-data.mjs
 * Writes data/stockdesk-db.json directly, then syncs via API if server is up.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "stockdesk-db.json");
const BASE = process.env.BASE_URL || "http://localhost:3210";
const today = new Date().toISOString().slice(0, 10);

function id() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const p1 = id();
const p2 = id();
const p3 = id();
const p4 = id();
const p5 = id();
const p6 = id();

const c1 = id();
const c2 = id();
const c3 = id();
const s1 = id();
const s2 = id();

const dummyDb = {
  products: [
    { id: p1, name: "01 CAR SWIM RING", category: "Toys", sku: "SR-001", costPrice: 92, salePrice: 130, qty: 405, threshold: 20 },
    { id: p2, name: "02 ELEPHANT SWIM RING", category: "Toys", sku: "SR-002", costPrice: 95, salePrice: 140, qty: 120, threshold: 15 },
    { id: p3, name: "023 Classic Clock Black", category: "Clocks", sku: "CLK-023", costPrice: 450, salePrice: 699, qty: -2, threshold: 5 },
    { id: p4, name: "Wall Clock Round White", category: "Clocks", sku: "CLK-024", costPrice: 320, salePrice: 499, qty: 48, threshold: 10 },
    { id: p5, name: "Plastic Bucket 15L", category: "Household", sku: "HH-101", costPrice: 55, salePrice: 85, qty: 200, threshold: 25 },
    { id: p6, name: "Steel Lunch Box", category: "Kitchen", sku: "KT-050", costPrice: 180, salePrice: 280, qty: 35, threshold: 8 },
  ],
  parties: [
    { id: c1, name: "Rahul Traders", type: "customer", phone: "9876543210", address: "Shop 12, Main Market, Delhi", openingBalance: 0 },
    { id: c2, name: "Priya General Store", type: "customer", phone: "9123456780", address: "Near Bus Stand, Jaipur", openingBalance: 500 },
    { id: c3, name: "Walk-in Customer", type: "customer", phone: "", address: "", openingBalance: 0 },
    { id: s1, name: "Gupta Wholesale", type: "supplier", phone: "9988776655", address: "Wholesale Hub, Agra", openingBalance: 0 },
    { id: s2, name: "Metro Distributors", type: "supplier", phone: "9012345678", address: "Industrial Area, Noida", openingBalance: 1200 },
  ],
  sales: [
    {
      id: id(),
      no: 1,
      date: today,
      partyId: c1,
      partyName: "Rahul Traders",
      items: [
        { productId: p1, name: "01 CAR SWIM RING", costPrice: 92, salePrice: 130, qty: 5 },
        { productId: p2, name: "02 ELEPHANT SWIM RING", costPrice: 95, salePrice: 140, qty: 2 },
      ],
      total: 930,
      paid: 500,
      payMode: "credit",
      note: "Thanks for doing business with us!",
      createdAt: Date.now() - 86400000,
    },
    {
      id: id(),
      no: 2,
      date: today,
      partyId: c3,
      partyName: "Walk-in Customer",
      items: [{ productId: p4, name: "Wall Clock Round White", costPrice: 320, salePrice: 499, qty: 1 }],
      total: 499,
      paid: 499,
      payMode: "cash",
      note: "",
      createdAt: Date.now() - 3600000,
    },
  ],
  purchases: [
    {
      id: id(),
      no: 1,
      date: today,
      partyId: s1,
      partyName: "Gupta Wholesale",
      items: [
        { productId: p1, name: "01 CAR SWIM RING", costPrice: 92, salePrice: 130, qty: 50 },
        { productId: p5, name: "Plastic Bucket 15L", costPrice: 55, salePrice: 85, qty: 100 },
      ],
      total: 10100,
      paid: 5000,
      payMode: "credit",
      note: "Monthly stock refill",
      createdAt: Date.now() - 172800000,
    },
  ],
  expenses: [
    { id: id(), date: today, amount: 1500, category: "Transport", note: "Delivery van fuel", createdAt: Date.now() - 7200000 },
    { id: id(), date: today, amount: 800, category: "Rent", note: "Shop electricity", createdAt: Date.now() - 14400000 },
  ],
  payments: [
    { id: id(), date: today, partyId: c1, type: "in", amount: 300, note: "Partial payment", createdAt: Date.now() - 43200000 },
    { id: id(), date: today, partyId: s2, type: "out", amount: 1000, note: "Advance to supplier", createdAt: Date.now() - 21600000 },
  ],
  trash: [],
  meta: {
    lastBackupAt: Date.now(),
    lastChangeAt: Date.now(),
    saleNo: 3,
    purchaseNo: 2,
  },
};

async function main() {
  console.log("Writing dummy data to", DB_PATH);
  await fs.writeFile(DB_PATH, JSON.stringify(dummyDb, null, 2), "utf8");
  console.log("File written:");
  console.log("  Products:", dummyDb.products.length);
  console.log("  Parties:", dummyDb.parties.length);
  console.log("  Sales:", dummyDb.sales.length);
  console.log("  Purchases:", dummyDb.purchases.length);

  const health = await fetch(BASE).catch(() => null);
  if (health?.ok) {
    const res = await fetch(`${BASE}/api/db`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dummyDb),
    });
    if (res.ok) console.log("Synced to running server at", BASE);
    else console.log("Server running but sync failed — refresh browser to reload.");
  } else {
    console.log("Server not running — start Open StockDesk.bat, then refresh browser.");
  }

  console.log("\nOpen http://localhost:3210 and try + Sale / + Purchase");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
