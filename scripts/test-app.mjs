/**
 * StockDesk integration & data-integrity tests (read-only on live database).
 * Run with server up: node scripts/test-app.mjs
 */

const BASE = process.env.BASE_URL || "http://localhost:3210";
let passed = 0;
let failed = 0;
const failures = [];

function ok(name) {
  passed++;
  console.log("  OK:", name);
}

function fail(name, detail) {
  failed++;
  const msg = detail ? `${name} — ${detail}` : name;
  failures.push(msg);
  console.error("  FAIL:", msg);
}

async function getDb() {
  const res = await fetch(`${BASE}/api/db`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET /api/db ${res.status}`);
  return res.json();
}

function billLineTotal(item, type) {
  const qty = Math.max(1, parseInt(item.qty, 10) || 1);
  const price = type === "sale" ? item.salePrice : item.costPrice;
  return qty * price;
}

function expectedBillTotal(bill, type) {
  return (bill.items || []).reduce((s, i) => s + billLineTotal(i, type), 0);
}

function ledgerContext(db) {
  return { sales: db.sales, purchases: db.purchases, payments: db.payments };
}

function computePartyBalance(party, ledger) {
  if (!party) return 0;
  let balance = party.openingBalance || 0;
  if (party.type === "customer") {
    ledger.sales
      .filter((s) => s.partyId === party.id)
      .forEach((s) => {
        balance += s.total - (s.paid || 0);
      });
    ledger.payments
      .filter((p) => p.partyId === party.id && p.type === "in")
      .forEach((p) => {
        balance -= p.amount;
      });
  } else {
    ledger.purchases
      .filter((p) => p.partyId === party.id)
      .forEach((p) => {
        balance += p.total - (p.paid || 0);
      });
    ledger.payments
      .filter((p) => p.partyId === party.id && p.type === "out")
      .forEach((p) => {
        balance -= p.amount;
      });
  }
  return balance;
}

// ─── Infrastructure ────────────────────────────────────────────────────────────

async function testServer() {
  const res = await fetch(BASE);
  if (res.ok) ok("Server responds on " + BASE);
  else fail("Server responds", String(res.status));
}

async function testHealth() {
  const res = await fetch(`${BASE}/api/health`);
  if (res.ok) ok("Health API responds");
  else fail("Health API", String(res.status));
}

async function testHtmlCriticalElements() {
  const res = await fetch(BASE);
  const html = await res.text();
  const checks = [
    ['id="billOverlay"', "Bill modal"],
    ['data-action="new-sale"', "New sale button"],
    ['data-action="new-purchase"', "New purchase button"],
    ['id="manageBackupsBtn"', "Backup manager button"],
    ['id="billPayMode"', "Payment mode field"],
    ['data-action="bill-pay-mode"', "Credit/Cash toggle"],
  ];
  checks.forEach(([needle, label]) => {
    if (html.includes(needle)) ok(`HTML: ${label}`);
    else fail(`HTML: ${label}`, "missing");
  });
}

async function testBackupsApi() {
  const res = await fetch(`${BASE}/api/backups`);
  if (!res.ok) return fail("Backups API", String(res.status));
  const data = await res.json();
  if (Array.isArray(data.backups)) ok(`Backups API (${data.backups.length} files)`);
  else fail("Backups API shape");
}

// ─── Database shape ────────────────────────────────────────────────────────────

async function testDbShape(db) {
  const keys = ["products", "parties", "sales", "purchases", "expenses", "payments", "trash", "meta"];
  keys.forEach((k) => {
    if (Array.isArray(db[k]) || (k === "meta" && db.meta)) ok(`DB has ${k}`);
    else fail(`DB has ${k}`);
  });
  if (db.meta?.saleNo >= 1 && db.meta?.purchaseNo >= 1) ok("Bill counters present");
  else fail("Bill counters", JSON.stringify(db.meta));
}

// ─── Every sale bill ───────────────────────────────────────────────────────────

function testAllSales(db) {
  if (!db.sales.length) {
    ok("Sales list empty (skipped line checks)");
    return;
  }
  const partyIds = new Set(db.parties.map((p) => p.id));
  const productIds = new Set(db.products.map((p) => p.id));
  let bad = 0;

  db.sales.forEach((bill, i) => {
    const label = `Sale #${bill.no || i + 1}`;
    const expected = expectedBillTotal(bill, "sale");
    if (bill.total !== expected) {
      fail(`${label} total`, `expected ${expected}, got ${bill.total}`);
      bad++;
    }
    if ((bill.paid || 0) < 0 || (bill.paid || 0) > bill.total) {
      fail(`${label} paid`, `paid=${bill.paid} total=${bill.total}`);
      bad++;
    }
    const due = bill.total - (bill.paid || 0);
    if (due < 0) {
      fail(`${label} due negative`, String(due));
      bad++;
    }
    if (bill.payMode === "cash" && (bill.paid || 0) !== bill.total) {
      fail(`${label} cash not fully paid`, `paid=${bill.paid}`);
      bad++;
    }
    if (bill.partyId && !partyIds.has(bill.partyId)) {
      fail(`${label} orphan party`, bill.partyId);
      bad++;
    }
    bill.items?.forEach((line) => {
      if (!productIds.has(line.productId)) {
        fail(`${label} orphan product`, line.productId);
        bad++;
      }
      if (!(line.qty > 0)) {
        fail(`${label} invalid qty`, String(line.qty));
        bad++;
      }
    });
  });

  if (!bad) ok(`All ${db.sales.length} sale bills pass integrity checks`);
}

// ─── Every purchase bill ───────────────────────────────────────────────────────

function testAllPurchases(db) {
  if (!db.purchases.length) {
    ok("Purchases list empty (skipped line checks)");
    return;
  }
  const partyIds = new Set(db.parties.map((p) => p.id));
  let bad = 0;

  db.purchases.forEach((bill, i) => {
    const label = `Purchase #${bill.no || i + 1}`;
    const expected = expectedBillTotal(bill, "purchase");
    if (bill.total !== expected) {
      fail(`${label} total`, `expected ${expected}, got ${bill.total}`);
      bad++;
    }
    if ((bill.paid || 0) < 0 || (bill.paid || 0) > bill.total) {
      fail(`${label} paid`, `paid=${bill.paid} total=${bill.total}`);
      bad++;
    }
    if (bill.payMode === "cash" && (bill.paid || 0) !== bill.total) {
      fail(`${label} cash not fully paid`, `paid=${bill.paid}`);
      bad++;
    }
    if (bill.partyId && !partyIds.has(bill.partyId)) {
      fail(`${label} orphan party`, bill.partyId);
      bad++;
    }
  });

  if (!bad) ok(`All ${db.purchases.length} purchase bills pass integrity checks`);
}

// ─── Payments ──────────────────────────────────────────────────────────────────

function testAllPayments(db) {
  const partyIds = new Set(db.parties.map((p) => p.id));
  let bad = 0;

  db.payments.forEach((p, i) => {
    const label = `Payment ${i + 1}`;
    if (!(p.amount > 0)) {
      fail(`${label} amount`, String(p.amount));
      bad++;
    }
    if (!["in", "out"].includes(p.type)) {
      fail(`${label} type`, p.type);
      bad++;
    }
    if (!partyIds.has(p.partyId)) {
      fail(`${label} orphan party`, p.partyId);
      bad++;
    }
  });

  if (!bad) ok(`All ${db.payments.length} payments valid`);
}

// ─── Products ──────────────────────────────────────────────────────────────────

function testProducts(db) {
  let bad = 0;
  db.products.forEach((p) => {
    if (p.costPrice == null || p.salePrice == null) {
      fail(`Product ${p.name} prices`, "missing cost/sale");
      bad++;
    }
    if (p.costPrice < 0 || p.salePrice < 0) {
      fail(`Product ${p.name} negative price`);
      bad++;
    }
  });
  if (!bad) ok(`All ${db.products.length} products have valid prices`);
}

// ─── Party balances ────────────────────────────────────────────────────────────

function testPartyBalanceConsistency(db) {
  const ledger = ledgerContext(db);
  let bad = 0;

  db.parties.forEach((party) => {
    const bal = computePartyBalance(party, ledger);
    if (!Number.isFinite(bal)) {
      fail(`Party ${party.name} balance`, "not finite");
      bad++;
    }
  });

  const receivable = db.parties
    .filter((p) => p.type === "customer")
    .reduce((s, p) => s + Math.max(0, computePartyBalance(p, ledger)), 0);
  const payable = db.parties
    .filter((p) => p.type === "supplier")
    .reduce((s, p) => s + Math.max(0, computePartyBalance(p, ledger)), 0);

  if (receivable >= 0) ok(`Total receivable computable (${receivable})`);
  else fail("Total receivable negative", String(receivable));

  if (payable >= 0) ok(`Total payable computable (${payable})`);
  else fail("Total payable negative", String(payable));

  if (!bad) ok("All party balances are finite numbers");
}

// ─── Bill numbers ──────────────────────────────────────────────────────────────

function testBillNumbers(db) {
  const saleNos = db.sales.map((s) => s.no);
  const purchNos = db.purchases.map((p) => p.no);
  const saleDupes = saleNos.length !== new Set(saleNos).size;
  const purchDupes = purchNos.length !== new Set(purchNos).size;

  if (!saleDupes) ok("Sale bill numbers unique");
  else fail("Sale bill numbers duplicate");

  if (!purchDupes) ok("Purchase bill numbers unique");
  else fail("Purchase bill numbers duplicate");

  const maxSale = saleNos.length ? Math.max(...saleNos) : 0;
  const maxPurch = purchNos.length ? Math.max(...purchNos) : 0;
  if (db.meta.saleNo > maxSale) ok(`Sale counter (${db.meta.saleNo}) > max bill #${maxSale}`);
  else if (db.sales.length) fail("Sale counter", `meta=${db.meta.saleNo} max=${maxSale}`);

  if (db.meta.purchaseNo > maxPurch) ok(`Purchase counter (${db.meta.purchaseNo}) > max bill #${maxPurch}`);
  else if (db.purchases.length) fail("Purchase counter", `meta=${db.meta.purchaseNo} max=${maxPurch}`);
}

// ─── Expenses ──────────────────────────────────────────────────────────────────

function testExpenses(db) {
  let bad = 0;
  db.expenses.forEach((e, i) => {
    if (!(e.amount > 0)) {
      fail(`Expense ${i + 1} amount`, String(e.amount));
      bad++;
    }
  });
  if (!bad) ok(`All ${db.expenses.length} expenses have positive amounts`);
}

// ─── Trash integrity ───────────────────────────────────────────────────────────

function testTrash(db) {
  const kinds = ["product", "party", "sale", "purchase", "expense", "payment"];
  let bad = 0;
  db.trash.forEach((t, i) => {
    if (!kinds.includes(t.kind)) {
      fail(`Trash item ${i + 1} kind`, t.kind);
      bad++;
    }
    if (!t.data) {
      fail(`Trash item ${i + 1} missing data`);
      bad++;
    }
  });
  if (!bad) ok(`Trash records valid (${db.trash.length} items)`);
}

// ─── Restore API security ──────────────────────────────────────────────────────

async function testBackupRestoreRejectsPathTraversal() {
  const res = await fetch(`${BASE}/api/backups/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "../../../etc/passwd" }),
  });
  if (res.status === 400) ok("Backup restore rejects path traversal");
  else fail("Backup restore path traversal", `status ${res.status}`);
}

async function main() {
  console.log("StockDesk integration tests\n============================");

  try {
    await testServer();
    await testHealth();
    const db = await getDb();
    testDbShape(db);
    testProducts(db);
    testAllSales(db);
    testAllPurchases(db);
    testAllPayments(db);
    testExpenses(db);
    testPartyBalanceConsistency(db);
    testBillNumbers(db);
    testTrash(db);
    await testHtmlCriticalElements();
    await testBackupsApi();
    await testBackupRestoreRejectsPathTraversal();
  } catch (err) {
    fail("Unexpected error", err.message);
  }

  console.log(`\n============================`);
  console.log(`${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("\nFailed:");
    failures.forEach((f) => console.log("  -", f));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
