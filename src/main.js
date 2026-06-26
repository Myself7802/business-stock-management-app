import { migrate } from "./store/database.js";
import { navigate, setRenderCallback, getCurrentPage, refresh } from "./router.js";
import { setupModalCloseHandlers, initDateFilters } from "./utils/ui.js";
import { renderBackupStatus, exportBackup, importBackup, applyBackupImport, openBackupManager, createServerBackup, restoreServerBackup } from "./services/backup.js";
import { renderHome } from "./views/home.js";
import { renderProducts, openProductForm, saveProduct, deleteProduct, exportProductsCsv, selectProduct, setupProductsPage } from "./views/products.js";
import { renderParties, openPartyForm, saveParty, deleteParty, selectPartyView, setupPartiesPage } from "./views/parties.js";
import { renderSales, renderPurchases, openBillForm, saveBill, setupBillAutocomplete, setupPartyAutocomplete, bindBillLineEvents, getBillLinesContainer, reprintBill, deleteBill, setPaymentMode, openPartyFromBill, openBillDetail, printBillDetail, setupBillListEvents } from "./views/bills.js";
import { renderExpenses, openExpenseForm, saveExpense, deleteExpense } from "./views/expenses.js";
import { renderPayments, openPaymentForm, openPaymentForParty, savePayment, deletePayment, setupPaymentsPage } from "./views/payments.js";
import { renderReports, renderPartyStatement, exportStatementCsv, printPartyStatement, switchReportTab } from "./views/reports.js";
import { renderTrash, handleRestore, handlePurge } from "./views/trash.js";

function renderPage() {
  renderBackupStatus();
  switch (getCurrentPage()) {
    case "home": renderHome(); break;
    case "sales": renderSales(); break;
    case "purchases": renderPurchases(); break;
    case "expenses": renderExpenses(); break;
    case "payments": renderPayments(); break;
    case "parties": renderParties(); break;
    case "products": renderProducts(); break;
    case "reports": renderReports(); break;
    case "trash": renderTrash(); break;
  }
}

function bindNavigation() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.page));
  });
}

function bindClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", handler);
}

function bindFormButtons() {
  bindClick("saveProductBtn", saveProduct);
  bindClick("savePartyBtn", saveParty);
  bindClick("saveBillBtn", () => saveBill({ print: false }));
  bindClick("printBillBtn", () => saveBill({ print: true }));
  bindClick("billDetailPrintBtn", printBillDetail);
  bindClick("saveExpenseBtn", saveExpense);
  bindClick("savePaymentBtn", savePayment);
  bindClick("exportBtn", exportBackup);
  bindClick("manageBackupsBtn", openBackupManager);
  bindClick("createBackupBtn", createServerBackup);
  bindClick("importBtn", () => document.getElementById("importFile")?.click());
  const importFile = document.getElementById("importFile");
  if (importFile) {
    importFile.addEventListener("change", (e) => {
      if (e.target.files[0]) importBackup(e.target.files[0]);
      e.target.value = "";
    });
  }
  bindClick("choiceReplace", async () => {
    if (confirm("Replace ALL data with this backup?")) {
      await applyBackupImport("replace");
      refresh();
    }
  });
  bindClick("choiceMerge", async () => {
    await applyBackupImport("merge");
    refresh();
  });
  bindClick("csvBtn", exportProductsCsv);
  const prodSearch = document.getElementById("prodSearch");
  if (prodSearch) prodSearch.addEventListener("input", renderProducts);
  const prodFilter = document.getElementById("prodFilter");
  if (prodFilter) prodFilter.addEventListener("change", renderProducts);
  ["salesFrom", "salesTo", "purchFrom", "purchTo", "expFrom", "expTo", "payFrom", "payTo"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", renderPage);
  });
  const stmtParty = document.getElementById("stmtParty");
  if (stmtParty) {
    stmtParty.addEventListener("change", () => {
      renderPartyStatement(document.getElementById("repFrom").value, document.getElementById("repTo").value);
    });
  }
  document.querySelectorAll(".report-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchReportTab(tab.dataset.report));
  });
}

function bindGlobalActions() {
  document.body.addEventListener("click", async (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.id;
    const type = target.dataset.type;
    const name = target.dataset.name;
    switch (action) {
      case "new-sale": openBillForm("sale"); break;
      case "new-purchase": openBillForm("purchase"); break;
      case "new-expense": openExpenseForm(); break;
      case "new-party": openPartyForm(); break;
      case "new-product": openProductForm(); break;
      case "payment-in": openPaymentForm("in"); break;
      case "payment-out": openPaymentForm("out"); break;
      case "apply-report": renderReports(); break;
      case "export-statement-csv": exportStatementCsv(); break;
      case "print-statement": printPartyStatement(); break;
      case "edit-product": openProductForm(id); break;
      case "select-product": selectProduct(id); break;
      case "delete-product": await deleteProduct(id); break;
      case "edit-party": openPartyForm(id); break;
      case "select-party-view": selectPartyView(id); break;
      case "delete-party": await deleteParty(id); break;
      case "delete-expense": await deleteExpense(id); break;
      case "edit-expense": openExpenseForm(id); break;
      case "edit-payment": openPaymentForm(null, id); break;
      case "party-record-payment": openPaymentForParty(id); break;
      case "delete-payment": await deletePayment(id); break;
      case "reprint-bill": reprintBill(id, type); break;
      case "delete-bill": await deleteBill(id, type); break;
      case "restore-trash": await handleRestore(id); break;
      case "purge-trash": await handlePurge(id); break;
      case "bill-pay-mode": setPaymentMode(target.dataset.mode); break;
      case "new-party-from-bill": openPartyFromBill(); break;
      case "restore-server-backup": await restoreServerBackup(name); break;
    }
  });
}

async function init() {
  await migrate();
  setRenderCallback(renderPage);
  setupModalCloseHandlers();
  bindGlobalActions();
  setupBillAutocomplete();
  setupPartyAutocomplete();
  setupProductsPage();
  setupPartiesPage();
  setupPaymentsPage();
  setupBillListEvents();
  bindBillLineEvents(getBillLinesContainer());
  bindNavigation();
  bindFormButtons();
  initDateFilters();
  renderBackupStatus();
  navigate("home");
}

init().catch((err) => {
  console.error(err);
  alert("StockDesk could not start. Please run Open StockDesk.bat (server must be running on port 3210).");
});
