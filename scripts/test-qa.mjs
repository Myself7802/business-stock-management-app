/**
 * StockDesk QA test suite — money, stock, and ledger integrity.
 * Run: node scripts/test-qa.mjs
 * Requires no server (pure unit tests).
 */

import {
  calcBillTotal,
  calcDue,
  computePartyBalance,
  computeProfitLoss,
  computeTotalPayable,
  computeTotalReceivable,
  isBillFullyPaid,
  lineAmount,
  normalizeBillItems,
  normalizeBillQty,
  resolveBillPaid,
  simulateCreditCashCreditSave,
  validateBillRecord,
  validatePaymentRecord,
} from "../src/domain/finance.js";
import {
  applyStockDeltas,
  canFulfillSale,
  expectedQtyFromBills,
  reverseStockDeltas,
  stockDeltasForBill,
} from "../src/domain/stock.js";

let passed = 0;
let failed = 0;
const failures = [];

function assert(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log("  OK:", name);
  } else {
    failed++;
    const msg = detail ? `${name} — ${detail}` : name;
    failures.push(msg);
    console.error("  FAIL:", msg);
  }
}

function assertEq(name, actual, expected) {
  assert(name, actual === expected, `expected ${expected}, got ${actual}`);
}

function assertNear(name, actual, expected, eps = 0.001) {
  assert(name, Math.abs(actual - expected) < eps, `expected ${expected}, got ${actual}`);
}

// ─── Bill line totals ───────────────────────────────────────────────────────

function testBillLineTotals() {
  console.log("\n[Bill totals]");
  const item = { productId: "p1", name: "Ring", costPrice: 92, salePrice: 130, qty: 5 };

  assertEq("Sale line uses sale price", lineAmount(item, "sale"), 650);
  assertEq("Purchase line uses cost price", lineAmount(item, "purchase"), 460);
  assertEq("Multi-line sale total", calcBillTotal([item, { ...item, qty: 2, salePrice: 140, costPrice: 95 }], "sale"), 650 + 280);
  assertEq("Multi-line purchase total", calcBillTotal([item], "purchase"), 460);
}

function testQtyNormalization() {
  console.log("\n[Qty normalization]");
  assertEq("Empty qty becomes 1", normalizeBillQty(""), 1);
  assertEq("Zero qty becomes 1", normalizeBillQty(0), 1);
  assertEq("String qty parsed", normalizeBillQty("3"), 3);
  assertEq("Float qty floored", normalizeBillQty(2.9), 2);
  assertEq("Negative qty becomes 1", normalizeBillQty(-5), 1);

  const items = normalizeBillItems([{ qty: 0, salePrice: 100, costPrice: 50 }]);
  assertEq("normalizeBillItems enforces min qty", items[0].qty, 1);
}

// ─── Payment / due ───────────────────────────────────────────────────────────

function testPaymentResolution() {
  console.log("\n[Payment resolution]");
  assertEq("Cash pays full total", resolveBillPaid({ payMode: "cash", total: 1000 }), 1000);
  assertEq("Credit unpaid", resolveBillPaid({ payMode: "credit", total: 1000, paidInput: 0 }), 0);
  assertEq("Credit partial", resolveBillPaid({ payMode: "credit", total: 1000, paidInput: 400 }), 400);
  assertEq("Credit overpay clamped", resolveBillPaid({ payMode: "credit", total: 1000, paidInput: 1500 }), 1000);
  assertEq("Credit negative treated as 0", resolveBillPaid({ payMode: "credit", total: 500, paidInput: -100 }), 0);
  assertEq("Credit uses draft when input empty", resolveBillPaid({ payMode: "credit", total: 800, paidInput: "", creditPaidDraft: 200 }), 200);
}

function testDueCalculation() {
  console.log("\n[Due calculation]");
  assertEq("Full due", calcDue(1000, 0), 1000);
  assertEq("Partial due", calcDue(1000, 300), 700);
  assertEq("Fully paid due zero", calcDue(1000, 1000), 0);
  assertEq("Overpaid due zero", calcDue(1000, 1200), 0);
  assert("Fully paid check", isBillFullyPaid(500, 500));
  assert("Unpaid not fully paid", !isBillFullyPaid(500, 0));
}

function testCreditCashCreditBug() {
  console.log("\n[Credit → Cash → Credit bug]");
  const total = 10100;

  assertEq(
    "Purchase credit→cash→credit saves unpaid",
    simulateCreditCashCreditSave({ total, creditPaidBeforeCash: 0 }),
    0
  );
  assertEq(
    "Partial credit preserved after toggle",
    simulateCreditCashCreditSave({ total, creditPaidBeforeCash: 5000 }),
    5000
  );
  assertEq(
    "Full credit before cash stays full after toggle",
    simulateCreditCashCreditSave({ total, creditPaidBeforeCash: 10100 }),
    10100
  );

  // Cash save path
  assertEq("Cash save always full", resolveBillPaid({ payMode: "cash", total: 499 }), 499);
}

// ─── Party balances ──────────────────────────────────────────────────────────

function testPartyBalances() {
  console.log("\n[Party balances]");

  const customer = { id: "c1", type: "customer", openingBalance: 500 };
  const supplier = { id: "s1", type: "supplier", openingBalance: 1200 };

  const ledger = {
    sales: [
      { partyId: "c1", total: 930, paid: 500 },
      { partyId: "c1", total: 499, paid: 499 },
    ],
    purchases: [{ partyId: "s1", total: 10100, paid: 5000 }],
    payments: [
      { partyId: "c1", type: "in", amount: 300 },
      { partyId: "s2", type: "out", amount: 1000 },
    ],
  };

  // Customer: 500 + (930-500) + (499-499) - 300 = 500 + 430 + 0 - 300 = 630
  assertEq("Customer receivable balance", computePartyBalance(customer, ledger), 630);

  // Supplier s1: 1200 + (10100-5000) = 6300 — but opening is on s2 in seed
  const supplierS1 = { id: "s1", type: "supplier", openingBalance: 0 };
  assertEq("Supplier payable balance", computePartyBalance(supplierS1, ledger), 5100);

  const supplierS2 = { id: "s2", type: "supplier", openingBalance: 1200 };
  assertEq("Supplier with opening + payment out", computePartyBalance(supplierS2, ledger), 200);

  const parties = [customer, supplierS1, supplierS2];
  assertEq("Total receivable sums positive customer balances", computeTotalReceivable(parties, ledger), 630);
  assertEq("Total payable sums positive supplier balances", computeTotalPayable(parties, ledger), 5100 + 200);
}

function testAdvanceBalances() {
  console.log("\n[Advance / overpayment balances]");
  const customer = { id: "c2", type: "customer", openingBalance: 0 };
  const ledger = {
    sales: [{ partyId: "c2", total: 1000, paid: 1200 }],
    purchases: [],
    payments: [],
  };
  assertEq("Customer overpayment gives negative balance", computePartyBalance(customer, ledger), -200);

  const supplier = { id: "s3", type: "supplier", openingBalance: 0 };
  const ledger2 = {
    sales: [],
    purchases: [{ partyId: "s3", total: 500, paid: 800 }],
    payments: [],
  };
  assertEq("Supplier overpayment gives negative balance", computePartyBalance(supplier, ledger2), -300);
}

// ─── Profit & loss ───────────────────────────────────────────────────────────

function testProfitLoss() {
  console.log("\n[Profit & loss]");
  const sales = [
    {
      date: "2026-06-01",
      items: [
        { qty: 5, salePrice: 130, costPrice: 92 },
        { qty: 2, salePrice: 140, costPrice: 95 },
      ],
    },
    {
      date: "2026-06-15",
      items: [{ qty: 1, salePrice: 499, costPrice: 320 }],
    },
  ];
  const expenses = [
    { date: "2026-06-10", amount: 1500 },
    { date: "2026-06-20", amount: 800 },
  ];

  const all = computeProfitLoss({ sales, expenses });
  assertEq("Sales total", all.salesTotal, 650 + 280 + 499);
  assertEq("COGS", all.cogs, 5 * 92 + 2 * 95 + 320);
  assertEq("Gross profit", all.gross, all.salesTotal - all.cogs);
  assertEq("Net profit", all.net, all.gross - 2300);

  const june = computeProfitLoss({ sales, expenses, from: "2026-06-01", to: "2026-06-14" });
  assertEq("Date filter excludes late sale", june.salesTotal, 930);
  assertEq("Date filter excludes late expense", june.expenseTotal, 1500);
}

// ─── Stock ───────────────────────────────────────────────────────────────────

function testStockMovement() {
  console.log("\n[Stock movement]");
  const products = [
    { id: "p1", name: "Ring", qty: 100 },
    { id: "p2", name: "Clock", qty: 50 },
  ];
  const items = [
    { productId: "p1", qty: 5, costPrice: 92, salePrice: 130 },
    { productId: "p2", qty: 2, costPrice: 320, salePrice: 499 },
  ];

  const saleDeltas = stockDeltasForBill("sale", items);
  assertEq("Sale reduces stock", saleDeltas.find((d) => d.productId === "p1").delta, -5);

  const afterSale = applyStockDeltas(products, saleDeltas);
  assertEq("Stock after sale p1", afterSale.find((p) => p.id === "p1").qty, 95);

  const purchDeltas = stockDeltasForBill("purchase", items);
  const afterPurchase = applyStockDeltas(products, purchDeltas);
  assertEq("Stock after purchase p1", afterPurchase.find((p) => p.id === "p1").qty, 105);

  const reversed = applyStockDeltas(afterSale, reverseStockDeltas("sale", items));
  assertEq("Reverse sale restores stock", reversed.find((p) => p.id === "p1").qty, 100);
}

function testStockIntegrity() {
  console.log("\n[Stock integrity helpers]");
  const sales = [{ items: [{ productId: "p1", qty: 10 }] }];
  const purchases = [{ items: [{ productId: "p1", qty: 50 }] }];
  assertEq("Expected qty from bills", expectedQtyFromBills("p1", { sales, purchases, openingQty: 100 }), 140);
  assert("Can fulfill when enough stock", canFulfillSale({ qty: 20 }, 15));
  assert("Cannot fulfill when short", !canFulfillSale({ qty: 5 }, 10));
}

// ─── Bill / payment validation ───────────────────────────────────────────────

function testBillValidation() {
  console.log("\n[Bill record validation]");
  const goodSale = {
    items: [{ productId: "p1", qty: 2, salePrice: 100, costPrice: 60 }],
    total: 200,
    paid: 200,
    payMode: "cash",
  };
  assertEq("Valid cash sale has no errors", validateBillRecord(goodSale, "sale").length, 0);

  const badTotal = { ...goodSale, total: 199 };
  assert("Wrong total flagged", validateBillRecord(badTotal, "sale").some((e) => e.includes("total")));

  const badCash = { ...goodSale, paid: 100 };
  assert("Cash with due flagged", validateBillRecord(badCash, "sale").length > 0);

  const creditUnpaid = {
    items: [{ productId: "p1", qty: 1, salePrice: 500, costPrice: 300 }],
    total: 500,
    paid: 0,
    payMode: "credit",
  };
  assertEq("Valid credit unpaid", validateBillRecord(creditUnpaid, "sale").length, 0);

  const purchase = {
    items: [{ productId: "p1", qty: 10, salePrice: 130, costPrice: 92 }],
    total: 920,
    paid: 0,
    payMode: "credit",
  };
  assertEq("Purchase uses cost for total check", validateBillRecord(purchase, "purchase").length, 0);
}

function testPaymentValidation() {
  console.log("\n[Payment validation]");
  assertEq("Valid payment in", validatePaymentRecord({ partyId: "c1", type: "in", amount: 500 }).length, 0);
  assert("Invalid amount flagged", validatePaymentRecord({ partyId: "c1", type: "in", amount: 0 }).length > 0);
  assert("Missing party flagged", validatePaymentRecord({ type: "out", amount: 100 }).length > 0);
  assert("Bad type flagged", validatePaymentRecord({ partyId: "s1", type: "x", amount: 100 }).length > 0);
}

// ─── Edge cases ──────────────────────────────────────────────────────────────

function testEdgeCases() {
  console.log("\n[Edge cases]");
  assertEq("Empty items total 0", calcBillTotal([], "sale"), 0);
  assertEq("resolveBillPaid cash on zero total", resolveBillPaid({ payMode: "cash", total: 0 }), 0);
  assertEq("Unknown party balance 0", computePartyBalance(null, {}), 0);
  assertNear("Floating partial payment", resolveBillPaid({ payMode: "credit", total: 100, paidInput: 33.33 }), 33.33);
}

// ─── Seed data golden values (matches scripts/seed-dummy-data.mjs) ─────────────

function testSeedGoldenValues() {
  console.log("\n[Seed data golden values]");
  const c1 = { id: "c1", type: "customer", openingBalance: 500 };
  const c2 = { id: "c2", type: "customer", openingBalance: 500 };
  const s1 = { id: "s1", type: "supplier", openingBalance: 0 };
  const s2 = { id: "s2", type: "supplier", openingBalance: 1200 };

  const ledger = {
    sales: [
      { partyId: "c1", total: 930, paid: 500 },
      { partyId: "c3", total: 499, paid: 499 },
    ],
    purchases: [{ partyId: "s1", total: 10100, paid: 5000 }],
    payments: [
      { partyId: "c1", type: "in", amount: 300 },
      { partyId: "s2", type: "out", amount: 1000 },
    ],
  };

  assertEq("Rahul Traders balance (seed)", computePartyBalance(c1, ledger), 630);
  assertEq("Priya opening only when no bills", computePartyBalance(c2, ledger), 500);
  assertEq("Gupta Wholesale payable (seed)", computePartyBalance(s1, ledger), 5100);
  assertEq("Metro Distributors after advance (seed)", computePartyBalance(s2, ledger), 200);

  const sale1Items = [
    { qty: 5, salePrice: 130, costPrice: 92 },
    { qty: 2, salePrice: 140, costPrice: 95 },
  ];
  assertEq("Seed sale #1 total", calcBillTotal(sale1Items, "sale"), 930);

  const purch1Items = [
    { qty: 50, salePrice: 130, costPrice: 92 },
    { qty: 100, salePrice: 85, costPrice: 55 },
  ];
  assertEq("Seed purchase #1 total", calcBillTotal(purch1Items, "purchase"), 10100);
}

async function main() {
  console.log("StockDesk QA unit tests\n========================");

  testBillLineTotals();
  testQtyNormalization();
  testPaymentResolution();
  testDueCalculation();
  testCreditCashCreditBug();
  testPartyBalances();
  testAdvanceBalances();
  testProfitLoss();
  testStockMovement();
  testStockIntegrity();
  testBillValidation();
  testPaymentValidation();
  testEdgeCases();
  testSeedGoldenValues();

  console.log(`\n========================`);
  console.log(`${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("\nFailed tests:");
    failures.forEach((f) => console.log("  -", f));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
