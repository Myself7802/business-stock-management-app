import * as db from "../store/database.js";
import { softDelete, saveAll, setProducts } from "../store/database.js";
import { esc, money, uid, escCsv, downloadBlob, todayStr } from "../utils/format.js";
import { openModal, closeModal, toast, isModalOpen } from "../utils/ui.js";
import { refresh } from "../router.js";

let selectedProductId = null;
let txnSearchQuery = "";

function formatDisplayDate(iso) {
  if (!iso) return "\u2014";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function getSelectedProductId() {
  return selectedProductId;
}

export function selectProduct(id) {
  selectedProductId = id;
  txnSearchQuery = "";
  renderProducts();
}

export function openProductForm(id) {
  document.getElementById("productModalTitle").textContent = id ? "Edit Product" : "Add Product";
  document.getElementById("productId").value = id || "";
  if (id) {
    const p = db.products.find((x) => x.id === id);
    document.getElementById("pName").value = p.name;
    document.getElementById("pCategory").value = p.category || "";
    document.getElementById("pSku").value = p.sku || "";
    document.getElementById("pCost").value = p.costPrice;
    document.getElementById("pSale").value = p.salePrice;
    document.getElementById("pQty").value = p.qty;
    document.getElementById("pThreshold").value = p.threshold ?? 5;
  } else {
    ["pName", "pCategory", "pSku", "pCost", "pSale", "pQty"].forEach((fieldId) => {
      document.getElementById(fieldId).value = "";
    });
    document.getElementById("pThreshold").value = 5;
  }
  openModal("productOverlay", { stacked: isModalOpen("billOverlay") });
}

export async function saveProduct() {
  const id = document.getElementById("productId").value;
  const name = document.getElementById("pName").value.trim();
  const costPrice = parseFloat(document.getElementById("pCost").value);
  const salePrice = parseFloat(document.getElementById("pSale").value);
  const qty = parseInt(document.getElementById("pQty").value, 10);
  if (!name) return alert("Enter product name.");
  const duplicate = db.products.find((p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== id);
  if (duplicate) return alert("Product name already exists. Use a different name.");
  if (isNaN(costPrice) || costPrice < 0 || isNaN(salePrice) || salePrice < 0) return alert("Enter valid prices.");
  if (isNaN(qty) || qty < 0) return alert("Enter valid quantity.");

  const data = {
    name,
    category: document.getElementById("pCategory").value.trim(),
    sku: document.getElementById("pSku").value.trim(),
    costPrice,
    salePrice,
    qty,
    threshold: parseInt(document.getElementById("pThreshold").value, 10) || 0,
  };

  if (id) Object.assign(db.products.find((p) => p.id === id), data);
  else {
    const newId = uid();
    db.products.push({ id: newId, ...data });
    selectedProductId = newId;
  }

  closeModal("productOverlay");
  await saveAll();
  refresh();
  toast("Product saved.");
}

export async function deleteProduct(id) {
  const product = db.products.find((p) => p.id === id);
  if (!product || !confirm(`Delete "${product.name}"?`)) return;
  softDelete("product", product);
  setProducts(db.products.filter((p) => p.id !== id));
  if (selectedProductId === id) selectedProductId = null;
  await saveAll();
  refresh();
  toast("Moved to trash.");
}

function filterProducts() {
  const query = document.getElementById("prodSearch").value.trim().toLowerCase();
  const filter = document.getElementById("prodFilter").value;
  return db.products.filter((p) => {
    const matchesQuery =
      !query ||
      p.name.toLowerCase().includes(query) ||
      (p.category || "").toLowerCase().includes(query) ||
      (p.sku || "").toLowerCase().includes(query);
    const threshold = p.threshold ?? 5;
    const matchesFilter = filter === "all" || (filter === "low" && p.qty <= threshold) || (filter === "out" && p.qty === 0);
    return matchesQuery && matchesFilter;
  });
}

function getProductHistory(productId) {
  const rows = [];
  db.sales.forEach((bill) => {
    bill.items
      .filter((item) => item.productId === productId)
      .forEach((item) => {
        const due = bill.total - (bill.paid || 0);
        rows.push({
          type: "sale",
          no: bill.no,
          partyName: bill.partyName || db.parties.find((p) => p.id === bill.partyId)?.name || "\u2014",
          date: bill.date,
          qty: item.qty,
          price: item.salePrice,
          status: due > 0 ? "Unpaid" : "Paid",
          billId: bill.id,
        });
      });
  });
  db.purchases.forEach((bill) => {
    bill.items
      .filter((item) => item.productId === productId)
      .forEach((item) => {
        const due = bill.total - (bill.paid || 0);
        rows.push({
          type: "purchase",
          no: bill.no,
          partyName: bill.partyName || db.parties.find((p) => p.id === bill.partyId)?.name || "\u2014",
          date: bill.date,
          qty: item.qty,
          price: item.costPrice,
          status: due > 0 ? "Unpaid" : "Paid",
          billId: bill.id,
        });
      });
  });
  return rows.sort((a, b) => b.date.localeCompare(a.date) || b.no - a.no);
}

function filterHistoryRows(rows) {
  const q = txnSearchQuery.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      String(r.no).includes(q) ||
      r.partyName.toLowerCase().includes(q) ||
      r.type.includes(q) ||
      r.date.includes(q) ||
      r.status.toLowerCase().includes(q)
  );
}

function qtyClass(qty, threshold = 5) {
  if (qty <= 0) return "stock-low";
  if (qty <= threshold) return "stock-warn";
  return "stock-ok";
}

function renderProductDetail(product) {
  const container = document.getElementById("prodDetail");
  const stockCls = qtyClass(product.qty, product.threshold ?? 5);
  const stockValue = product.qty * product.costPrice;
  const history = filterHistoryRows(getProductHistory(product.id));
  const allHistory = getProductHistory(product.id);

  let txHtml = "";
  if (!allHistory.length) {
    txHtml = '<div class="products-tx-empty">No transactions yet for this item.</div>';
  } else if (!history.length) {
    txHtml = '<div class="products-tx-empty">No transactions match your search.</div>';
  } else {
    txHtml = `<table class="products-tx-table"><thead><tr>
      <th class="col-dot"></th>
      <th>Type</th>
      <th>Invoice / Ref. No</th>
      <th>Name</th>
      <th>Date</th>
      <th class="col-num">Quantity</th>
      <th class="col-num">Price / Unit</th>
      <th>Status</th>
    </tr></thead><tbody>`;
    history.forEach((row) => {
      const dotCls = row.type === "sale" ? "dot-sale" : "dot-purchase";
      const typeLabel = row.type === "sale" ? "Sale" : "Purchase";
      const statusCls = row.status === "Paid" ? "status-paid" : "status-unpaid";
      txHtml += `<tr>
        <td class="col-dot"><span class="tx-dot ${dotCls}" title="${typeLabel}"></span></td>
        <td class="tx-type-cell">${typeLabel}</td>
        <td><b>${row.no}</b></td>
        <td>${esc(row.partyName)}</td>
        <td>${formatDisplayDate(row.date)}</td>
        <td class="col-num">${row.qty}</td>
        <td class="col-num">${money(row.price)}</td>
        <td><span class="tx-status ${statusCls}">${row.status}</span></td>
      </tr>`;
    });
    txHtml += "</tbody></table>";
  }

  const stockWarn = product.qty <= 0 ? '<span class="stock-warn-icon" title="Low or negative stock">!</span>' : "";

  container.innerHTML = `
    <div class="products-detail-inner">
      <div class="products-detail-top">
        <div class="products-detail-title">
          <h2>${esc(product.name)}</h2>
          ${product.category ? `<span class="products-detail-meta">${esc(product.category)}</span>` : ""}
        </div>
        <button class="btn-primary btn-sm" data-action="edit-product" data-id="${product.id}" type="button">Adjust Item</button>
      </div>
      <div class="products-kpi-row">
        <div class="products-kpi">
          <div class="kpi-label">Sale Price</div>
          <div class="kpi-value">${money(product.salePrice)} <span class="kpi-sub">(excl)</span></div>
        </div>
        <div class="products-kpi">
          <div class="kpi-label">Purchase Price</div>
          <div class="kpi-value">${money(product.costPrice)} <span class="kpi-sub">(excl)</span></div>
        </div>
        <div class="products-kpi">
          <div class="kpi-label">Stock Quantity</div>
          <div class="kpi-value ${stockCls}">${product.qty}${stockWarn}</div>
        </div>
        <div class="products-kpi">
          <div class="kpi-label">Stock Value</div>
          <div class="kpi-value">${money(stockValue)}</div>
        </div>
      </div>
      <div class="products-tx-section">
        <div class="products-tx-head">
          <h3>Transactions</h3>
          <input type="search" id="prodTxnSearch" class="products-tx-search" placeholder="Search transactions..." value="${esc(txnSearchQuery)}" />
        </div>
        <div class="products-tx-table-wrap">${txHtml}</div>
      </div>
    </div>`;
}

function renderEmptyDetail(message) {
  document.getElementById("prodDetail").innerHTML = `
    <div class="products-empty-state">
      <div class="products-empty-icon" aria-hidden="true"></div>
      <p>${message}</p>
    </div>`;
}

export function renderProducts() {
  const rows = filterProducts();
  if (!selectedProductId || !db.products.find((p) => p.id === selectedProductId)) {
    selectedProductId = rows[0]?.id || null;
  }

  document.getElementById("prodCount").textContent = rows.length + " items";
  const sidebar = document.getElementById("prodSidebarList");

  if (!rows.length) {
    sidebar.innerHTML = '<div class="products-list-empty">No items found.</div>';
    renderEmptyDetail("Add an item to get started.");
    return;
  }

  let listHtml = "";
  rows.forEach((p) => {
    const active = p.id === selectedProductId ? " active" : "";
    const qCls = qtyClass(p.qty, p.threshold ?? 5);
    listHtml += `<button type="button" class="products-list-item${active}" data-action="select-product" data-id="${p.id}">
      <span class="products-list-name" title="${esc(p.name)}">${esc(p.name)}</span>
      <span class="products-list-qty ${qCls}">${p.qty}</span>
    </button>`;
  });
  sidebar.innerHTML = listHtml;

  const selected = db.products.find((p) => p.id === selectedProductId);
  if (selected) renderProductDetail(selected);
  else renderEmptyDetail("Select an item from the list to view stock and transaction history.");
}

export function setupProductsPage() {
  const detail = document.getElementById("prodDetail");
  if (!detail || detail.dataset.bound) return;
  detail.dataset.bound = "1";
  detail.addEventListener("input", (e) => {
    if (e.target.id !== "prodTxnSearch") return;
    txnSearchQuery = e.target.value;
    const selected = db.products.find((p) => p.id === selectedProductId);
    if (selected) renderProductDetail(selected);
    const search = document.getElementById("prodTxnSearch");
    if (search) {
      search.focus();
      search.setSelectionRange(search.value.length, search.value.length);
    }
  });
}

export function exportProductsCsv() {
  if (!db.products.length) return toast("No products.");
  const lines = [["Name", "Category", "SKU", "PurchasePrice", "SellingPrice", "Qty", "StockValue"].join(",")];
  db.products.forEach((p) => {
    lines.push([p.name, p.category || "", p.sku || "", p.costPrice, p.salePrice, p.qty, (p.qty * p.costPrice).toFixed(2)].map(escCsv).join(","));
  });
  downloadBlob("\uFEFF" + lines.join("\n"), "stockdesk-products-" + todayStr() + ".csv", "text/csv;charset=utf-8");
  toast("CSV exported.");
}
