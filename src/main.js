import { migrate } from "./store/database.js";
import { navigate, setRenderCallback, getCurrentPage, refresh } from "./router.js";
import { setupModalCloseHandlers, initDateFilters } from "./utils/ui.js";
import { renderBackupStatus, exportBackup, importBackup, applyBackupImport } from "./services/backup.js";

import { renderHome } from "./views/home.js";
import {
  renderProducts,
  openProductForm,
  saveProduct,
  deleteProduct,
  exportProductsCsv,
} from "./views/products.js";
import {
  renderParties,
  openPartyForm,
  saveParty,
  deleteParty,
} from "./views/parties.js";
import {
  renderSales,
  renderPurchases,
  openBillForm,
  saveBill,
  setupBillAutocomplete,
  bindBillLineEvents,
  getBillLinesContainer,
  reprintBill,
  deleteBill,
  addProductToBill,
} from "./views/bills.js";
import {
  renderExpenses,
  openExpenseForm,
  saveExpense,
  deleteExpense,
} from "./views/expenses.js";
import {
  renderPayments,
  openPaymentForm,
  savePayment,
  deletePayment,
} from "./views/payments.js";
import {
  renderReports,
  renderPartyStatement,
  exportStatementCsv,
  printPartyStatement,
  switchReportTab,
} from "./views/reports.js";
import { renderTrash, handleRestore, handlePurge } from "./views/trash.js";

function renderPage() {
  renderBackupStatus();

  switch (getCurrentPage()) {
    case "home":
      renderHome();
      break;
    case "sales":
      renderSales();
      break;
    case "purchases":
      renderPurchases();
      break;
    case "expenses":
      renderExpenses();
      break;
    case "payments":
      renderPayments();
      break;
    case "parties":
      renderParties();
      break;
    case "products":
      renderProducts();
      break;
    case "reports":
      renderReports();
      break;
    case "trash":
      renderTrash();
      break;
  }
}

function bindNavigation() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.page));
  });
}

function bindFormButtons() {
  document.getElementById("saveProductBtn").addEventListener("click", saveProduct);
  document.getElementById("savePartyBtn").addEventListener("click", saveParty);
  document.getElementById("saveBillBtn").addEventListener("click", saveBill);
  document.getElementById("saveExpenseBtn").addEventListener("click", saveExpense);
  document.getElementById("savePaymentBtn").addEventListener("click", savePayment);

  document.getElementById("exportBtn").addEventListener("click", exportBackup);
  document.getElementById("importBtn").addEventListener("click", () =>
    document.getElementById("importFile").click()
  );
  document.getElementById("importFile").addEventListener("change", (e) => {
    if (e.target.files[0]) importBackup(e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("choiceReplace").addEventListener("click", () => {
    if (confirm("Replace ALL data with this backup?")) {
      applyBackupImport("replace");
      refresh();
    }
  });
  document.getElementById("choiceMerge").addEventListener("click", () => {
    applyBackupImport("merge");
    refresh();
  });

  document.getElementById("csvBtn").addEventListener("click", exportProductsCsv);
  document.getElementById("prodSearch").addEventListener("input", renderProducts);
  document.getElementById("prodFilter").addEventListener("change", renderProducts);

  ["salesFrom", "salesTo", "purchFrom", "purchTo", "expFrom", "expTo", "payFrom", "payTo"].forEach(
    (id) => document.getElementById(id).addEventListener("change", renderPage)
  );

  document.getElementById("stmtParty").addEventListener("change", () => {
    renderPartyStatement(
      document.getElementById("repFrom").value,
      document.getElementById("repTo").value
    );
  });

  document.querySelectorAll(".report-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchReportTab(tab.dataset.report));
  });
}

function bindGlobalActions() {
  document.body.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;
    const id = target.dataset.id;
    const type = target.dataset.type;

    switch (action) {
      case "new-sale":
        openBillForm("sale");
        break;
      case "new-purchase":
        openBillForm("purchase");
        break;
      case "new-expense":
        openExpenseForm();
        break;
      case "new-party":
        openPartyForm();
        break;
      case "new-product":
        openProductForm();
        break;
      case "payment-in":
        openPaymentForm("in");
        break;
      case "payment-out":
        openPaymentForm("out");
        break;
      case "apply-report":
        renderReports();
        break;
      case "export-statement-csv":
        exportStatementCsv();
        break;
      case "print-statement":
        printPartyStatement();
        break;
      case "edit-product":
        openProductForm(id);
        break;
      case "delete-product":
        deleteProduct(id);
        break;
      case "edit-party":
        openPartyForm(id);
        break;
      case "delete-party":
        deleteParty(id);
        break;
      case "delete-expense":
        deleteExpense(id);
        break;
      case "delete-payment":
        deletePayment(id);
        break;
      case "reprint-bill":
        reprintBill(id, type);
        break;
      case "delete-bill":
        deleteBill(id, type);
        break;
      case "restore-trash":
        handleRestore(id);
        break;
      case "purge-trash":
        handlePurge(id);
        break;
      case "bill-add-product":
        addProductToBill(id);
        break;
    }
  });
}

function init() {
  migrate();
  setRenderCallback(renderPage);
  setupModalCloseHandlers();
  setupBillAutocomplete();
  bindBillLineEvents(getBillLinesContainer());
  bindNavigation();
  bindFormButtons();
  bindGlobalActions();
  initDateFilters();
  renderBackupStatus();
  navigate("home");
}

init();
