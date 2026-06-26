import * as db from "../store/database.js";
import { softDelete, saveAll, nextBillNo, setSales, setPurchases, meta } from "../store/database.js";
import { partyBalance, partyBalanceInfo } from "../services/parties.js";
import { printBill } from "../services/print.js";
import { reverseBillStock } from "../services/trash.js";
import { esc, money, uid, todayStr, inRange } from "../utils/format.js";
import { openModal, closeModal, toast } from "../utils/ui.js";
import { navigate, refresh } from "../router.js";
import { openPartyForm } from "./parties.js";
import {
  calcBillTotal as domainCalcBillTotal,
  normalizeBillItems,
  resolveBillPaid,
} from "../domain/finance.js";

const EM_DASH = "\u2014";
const TIMES = "\u00d7";

let billItems = [];
let creditPaidDraft = 0;

function billType() {
  return document.getElementById("billType").value;
}

function partyFilterType() {
  return billType() === "sale" ? "customer" : "supplier";
}

function lineUnitPrice(item) {
  return billType() === "sale" ? item.salePrice : item.costPrice;
}

function lineQty(item) {
  return parseFloat(item.qty) || 0;
}

function calcBillTotal() {
  return billItems.reduce((sum, item) => sum + lineQty(item) * lineUnitPrice(item), 0);
}

function lineAmount(item) {
  return lineQty(item) * lineUnitPrice(item);
}

function syncBillTotals() {
  document.getElementById("billTotal").textContent = money(calcBillTotal());
  updateDueDisplay();
}

function syncBillLineRow(index) {
  const item = billItems[index];
  const row = document.querySelector(`#billLines tr[data-line="${index}"]`);
  if (!item || !row) return;
  const unit = lineUnitPrice(item);
  const amount = lineAmount(item);
  const priceInput = row.querySelector('[data-action="bill-price"]');
  const amountInput = row.querySelector('[data-action="bill-amount"]');
  if (priceInput && document.activeElement !== priceInput) priceInput.value = unit;
  if (amountInput && document.activeElement !== amountInput) amountInput.value = amount ? amount.toFixed(2) : "0";
  syncBillTotals();
}

function getResolvedPaid(total) {
  const mode = document.getElementById("billPayMode").value;
  return resolveBillPaid({
    payMode: mode,
    total,
    paidInput: document.getElementById("billPaid").value,
    creditPaidDraft,
  });
}

function updateDueDisplay() {
  const total = calcBillTotal();
  const paidEl = document.getElementById("billPaid");
  const mode = document.getElementById("billPayMode").value;
  const isSale = billType() === "sale";
  if (mode === "cash") {
    paidEl.value = total ? total.toFixed(2) : "0";
    paidEl.readOnly = true;
  } else {
    paidEl.readOnly = false;
    const paid = getResolvedPaid(total);
    if (paid !== parseFloat(paidEl.value)) paidEl.value = paid ? paid.toFixed(2) : "0";
    creditPaidDraft = paid;
  }
  const due = Math.max(0, total - getResolvedPaid(total));
  document.getElementById("billDue").textContent = money(due);
  const dueRow = document.getElementById("billDueRow");
  dueRow.style.display = mode === "cash" ? "none" : "";
  const dueLabel = document.getElementById("billDueLabel");
  if (dueLabel) {
    dueLabel.textContent = isSale ? "Due from Customer" : "Due to Supplier";
  }
}

function balanceLabel(party) {
  const info = partyBalanceInfo(party.id);
  const arrow = info.balance > 0 ? "\u2191" : info.balance < 0 ? "\u2193" : "";
  return `<span class="${info.cls}">${money(info.abs)} ${arrow} <small>${info.label}</small></span>`;
}

function closePartyAc() {
  document.getElementById("billPartyAcList")?.classList.remove("show");
}

function closeProductAc() {
  document.getElementById("billAcList")?.classList.remove("show");
}

function closeBillAcLists() {
  closePartyAc();
  closeProductAc();
}

function clearPartySelection() {
  document.getElementById("billPartyId").value = "";
  document.getElementById("billPartySearch").value = "";
  document.getElementById("billPartyPhone").value = "";
  document.getElementById("billPartyAddress").value = "";
  document.getElementById("billPartyBalance").value = "";
}

export function selectParty(partyId) {
  const party = db.parties.find((p) => p.id === partyId);
  if (!party) return;
  document.getElementById("billPartyId").value = party.id;
  document.getElementById("billPartySearch").value = party.name;
  document.getElementById("billPartyPhone").value = party.phone || EM_DASH;
  document.getElementById("billPartyAddress").value = party.address || EM_DASH;
  const info = partyBalanceInfo(party.id);
  document.getElementById("billPartyBalance").value = `${money(info.abs)} (${info.label})`;
  closePartyAc();
}

export function setPaymentMode(mode) {
  const paidEl = document.getElementById("billPaid");
  const prevMode = document.getElementById("billPayMode").value;

  if (prevMode === "credit" && mode === "cash") {
    creditPaidDraft = parseFloat(paidEl.value) || 0;
  }

  document.getElementById("billPayMode").value = mode;
  document.querySelectorAll(".pay-mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
  const paidWrap = document.getElementById("billPaidWrap");
  paidWrap.style.display = mode === "cash" ? "none" : "";

  if (mode === "credit") {
    paidEl.readOnly = false;
    paidEl.value = creditPaidDraft ? creditPaidDraft.toFixed(2) : "0";
  }

  updateDueDisplay();
}

function applyBillFormType(type) {
  const isSale = type === "sale";
  document.getElementById("billPartyLabel").textContent = isSale ? "Customer / Party *" : "Supplier / Party *";
  document.getElementById("billPaidLabel").textContent = isSale ? "Amount Received (\u20B9)" : "Amount Paid (\u20B9)";
  document.getElementById("billPriceColHeader").textContent = isSale ? "Sale \u20B9" : "Purchase \u20B9";
  document.getElementById("billPartySearch").placeholder = isSale
    ? "Search customer by name or phone..."
    : "Search supplier by name or phone...";
  const creditLbl = document.getElementById("billCreditLabel");
  const cashLbl = document.getElementById("billCashLabel");
  const payHint = document.getElementById("billPayHint");
  if (creditLbl) creditLbl.textContent = isSale ? "Credit (Pending)" : "Credit (To Pay)";
  if (cashLbl) cashLbl.textContent = isSale ? "Cash (Received)" : "Cash (Paid)";
  if (payHint) {
    payHint.textContent = isSale
      ? "Credit = customer will pay later. Cash = payment received now."
      : "Credit = you will pay supplier later. Cash = already paid supplier.";
  }
  updateDueDisplay();
}

export function openBillForm(type) {
  document.getElementById("billType").value = type;
  applyBillFormType(type);
  document.getElementById("billModalTitle").textContent = type === "sale" ? "New Sale" : "New Purchase";
  document.getElementById("billNoPreview").textContent = type === "sale" ? meta.saleNo : meta.purchaseNo;
  document.getElementById("billDate").value = todayStr();
  document.getElementById("billNote").value = "";
  document.getElementById("billProductSearch").value = "";
  closeBillAcLists();
  clearPartySelection();
  billItems = [];
  creditPaidDraft = 0;
  setPaymentMode("credit");
  document.getElementById("billPaid").value = 0;
  renderBillLines();
  openModal("billOverlay");
}

function renderBillLines() {
  const container = document.getElementById("billLines");
  const colSpan = 6;
  if (!billItems.length) {
    container.innerHTML = `<tr><td colspan="${colSpan}" class="muted" style="padding:12px;text-align:center">No items yet ${EM_DASH} search and add products above.</td></tr>`;
    document.getElementById("billTotal").textContent = money(0);
    updateDueDisplay();
    return;
  }

  let html = "";
  billItems.forEach((item, index) => {
    const unitPrice = lineUnitPrice(item);
    const lineTotal = lineAmount(item);
    html += `<tr data-line="${index}">
      <td>${index + 1}</td>
      <td><b>${esc(item.name)}</b></td>
      <td><input type="number" min="1" step="1" value="${lineQty(item)}" class="bill-num-input" data-action="bill-qty" data-index="${index}" /></td>
      <td><input type="number" min="0" step="0.01" value="${unitPrice}" class="bill-num-input" data-action="bill-price" data-index="${index}" /></td>
      <td><input type="number" min="0" step="0.01" value="${lineTotal ? lineTotal.toFixed(2) : "0"}" class="bill-num-input" data-action="bill-amount" data-index="${index}" /></td>
      <td><button class="btn-ghost btn-sm" type="button" data-action="bill-remove" data-index="${index}">${TIMES}</button></td>
    </tr>`;
  });
  container.innerHTML = html;
  syncBillTotals();
}

export function updateBillQty(index, value, { rerender = false } = {}) {
  billItems[index].qty = Math.max(1, parseInt(value, 10) || 1);
  if (rerender) renderBillLines();
  else syncBillLineRow(index);
}

export function updateBillPrice(index, value) {
  const v = parseFloat(value);
  if (isNaN(v) || v < 0) return;
  if (billType() === "sale") billItems[index].salePrice = v;
  else billItems[index].costPrice = v;
  syncBillLineRow(index);
}

export function updateBillAmount(index, value) {
  const amt = parseFloat(value);
  const qty = lineQty(billItems[index]) || 1;
  if (isNaN(amt) || amt < 0 || qty <= 0) return;
  const unit = amt / qty;
  if (billType() === "sale") billItems[index].salePrice = unit;
  else billItems[index].costPrice = unit;
  syncBillLineRow(index);
}

export function removeBillLine(index) {
  billItems.splice(index, 1);
  renderBillLines();
}

function renderPartyAcList(query) {
  const list = document.getElementById("billPartyAcList");
  closeProductAc();
  const type = partyFilterType();
  const q = query.trim().toLowerCase();
  const parties = db.parties
    .filter((p) => p.type === type)
    .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.phone || "").includes(q))
    .slice(0, 12);

  let html = `<div class="ac-add-row"><button type="button" class="link-btn" data-action="new-party-from-bill">+ Add Party</button></div>`;
  html += `<div class="ac-table-head ac-party-head"><span>Party</span><span>Phone</span><span>Balance</span></div>`;
  if (!parties.length) {
    html += '<div class="ac-item muted">No party found</div>';
  } else {
    html += parties
      .map(
        (p) => `<div class="ac-item ac-row ac-party-row" data-action="bill-select-party" data-id="${p.id}">
          <span class="ac-col-name">${esc(p.name)}</span>
          <span class="ac-col-phone">${esc(p.phone || EM_DASH)}</span>
          <span class="ac-col-balance">${balanceLabel(p)}</span>
        </div>`
      )
      .join("");
  }
  list.innerHTML = html;
  list.classList.add("show");
}

function renderProductAcList(query) {
  const list = document.getElementById("billAcList");
  closePartyAc();
  const q = query.trim().toLowerCase();
  const matches = db.products
    .filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
    )
    .slice(0, 12);

  let html = `<div class="ac-add-row"><button type="button" class="link-btn" data-action="new-product-from-bill">+ Add Item</button></div>`;
  html += `<div class="ac-table-head ac-product-head"><span>Item</span><span>Sale Price</span><span>Purchase Price</span><span>Stock</span></div>`;
  if (!matches.length) {
    html += '<div class="ac-item muted">No item found</div>';
  } else {
    html += matches
      .map((p) => {
        const stockCls = p.qty <= 0 ? "stock-low" : "stock-ok";
        return `<div class="ac-item ac-row ac-product-row" data-action="bill-add-product" data-id="${p.id}">
          <span class="ac-col-name">${esc(p.name)}</span>
          <span>${money(p.salePrice)}</span>
          <span>${money(p.costPrice)}</span>
          <span class="${stockCls}">${p.qty}</span>
        </div>`;
      })
      .join("");
  }
  list.innerHTML = html;
  list.classList.add("show");
}

export function setupPartyAutocomplete() {
  const input = document.getElementById("billPartySearch");
  const list = document.getElementById("billPartyAcList");

  input.addEventListener("input", () => renderPartyAcList(input.value));
  input.addEventListener("click", () => renderPartyAcList(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      list.querySelector("[data-action='bill-select-party']")?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    }
    if (e.key === "Escape") closePartyAc();
  });

  list.addEventListener("mousedown", (e) => {
    const addBtn = e.target.closest("[data-action='new-party-from-bill']");
    if (addBtn) {
      e.preventDefault();
      e.stopPropagation();
      closeBillAcLists();
      openPartyFromBill();
      return;
    }
    const row = e.target.closest("[data-action='bill-select-party']");
    if (!row) return;
    e.preventDefault();
    e.stopPropagation();
    selectParty(row.dataset.id);
  });
}

export function setupBillAutocomplete() {
  const input = document.getElementById("billProductSearch");
  const list = document.getElementById("billAcList");

  input.addEventListener("input", () => renderProductAcList(input.value));
  input.addEventListener("click", () => renderProductAcList(input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      list.querySelector("[data-action='bill-add-product']")?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    }
    if (e.key === "Escape") closeProductAc();
  });

  list.addEventListener("mousedown", (e) => {
    const addBtn = e.target.closest("[data-action='new-product-from-bill']");
    if (addBtn) {
      e.preventDefault();
      e.stopPropagation();
      closeBillAcLists();
      import("./products.js").then((m) => m.openProductForm());
      return;
    }
    const row = e.target.closest("[data-action='bill-add-product']");
    if (!row) return;
    e.preventDefault();
    e.stopPropagation();
    addProductToBill(row.dataset.id);
  });

  document.getElementById("billPaid").addEventListener("input", () => {
    if (document.getElementById("billPayMode").value === "credit") {
      creditPaidDraft = parseFloat(document.getElementById("billPaid").value) || 0;
    }
    updateDueDisplay();
  });

  document.getElementById("billOverlay")?.addEventListener("mousedown", (e) => {
    if (e.target.closest(".bill-party-block")) return;
    if (e.target.closest(".bill-product-search")) return;
    closeBillAcLists();
  });
}

export function openPartyFromBill() {
  openPartyForm();
  const typeEl = document.getElementById("partyType");
  if (typeEl) typeEl.value = partyFilterType();
}

export function addProductToBill(productId) {
  const product = db.products.find((p) => p.id === productId);
  if (!product) return;
  const existing = billItems.find((item) => item.productId === productId);
  if (existing) existing.qty++;
  else {
    billItems.push({
      productId: product.id,
      name: product.name,
      costPrice: product.costPrice,
      salePrice: product.salePrice,
      qty: 1,
    });
  }
  document.getElementById("billProductSearch").value = "";
  closeBillAcLists();
  renderBillLines();
}

export async function saveBill(options = {}) {
  const shouldPrint = options.print === true;
  const type = billType();
  const partyId = document.getElementById("billPartyId").value;
  const date = document.getElementById("billDate").value;
  const mode = document.getElementById("billPayMode").value;
  const normalizedItems = normalizeBillItems(billItems);

  const total = domainCalcBillTotal(normalizedItems, type);
  const paid = getResolvedPaid(total);
  const note = document.getElementById("billNote").value.trim();
  const party = db.parties.find((p) => p.id === partyId);

  if (!partyId) {
    alert("Select a party.");
    return;
  }
  if (!billItems.length) {
    alert("Add at least one product.");
    return;
  }

  for (const item of normalizedItems) {
    const product = db.products.find((p) => p.id === item.productId);
    if (type === "sale" && product.qty < item.qty) {
      alert(`Not enough stock for ${product.name}. Available: ${product.qty}`);
      return;
    }
  }

  const bill = {
    id: uid(),
    no: nextBillNo(type),
    date,
    partyId,
    partyName: party?.name || "",
    items: normalizedItems,
    total,
    paid,
    payMode: mode,
    note,
    createdAt: Date.now(),
  };

  normalizedItems.forEach((item) => {
    const product = db.products.find((p) => p.id === item.productId);
    if (type === "sale") product.qty -= item.qty;
    else product.qty += item.qty;
  });

  if (type === "sale") db.sales.push(bill);
  else db.purchases.push(bill);

  closeModal("billOverlay");
  await saveAll();
  if (shouldPrint) printBill(bill, type);
  navigate(type === "sale" ? "sales" : "purchases");
  toast((type === "sale" ? "Sale" : "Purchase") + " bill saved." + (shouldPrint ? " Printing..." : ""));
}

let detailBillId = null;
let detailBillType = null;

function billItemsSummary(bill) {
  if (!bill.items?.length) return EM_DASH;
  const names = bill.items.map((i) => i.name);
  if (names.length <= 2) return esc(names.join(", "));
  return `${esc(names.slice(0, 2).join(", "))} <span class="muted">+${names.length - 2} more</span>`;
}

function formatDisplayDate(iso) {
  if (!iso) return EM_DASH;
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function openBillDetail(id, type) {
  const list = type === "sale" ? db.sales : db.purchases;
  const bill = list.find((b) => b.id === id);
  if (!bill) return;

  detailBillId = id;
  detailBillType = type;
  const isSale = type === "sale";
  const party = db.parties.find((p) => p.id === bill.partyId);
  const partyName = party?.name || bill.partyName || EM_DASH;
  const due = bill.total - (bill.paid || 0);
  const priceLabel = isSale ? "Sale \u20B9" : "Purchase \u20B9";

  let rows = "";
  bill.items.forEach((item, index) => {
    const unit = isSale ? item.salePrice : item.costPrice;
    const lineTotal = (parseFloat(item.qty) || 0) * unit;
    rows += `<tr>
      <td>${index + 1}</td>
      <td><b>${esc(item.name)}</b></td>
      <td>${item.qty}</td>
      <td>${money(unit)}</td>
      <td>${money(lineTotal)}</td>
    </tr>`;
  });

  document.getElementById("billDetailTitle").textContent = `${isSale ? "Sale" : "Purchase"} Bill #${bill.no}`;
  document.getElementById("billDetailBody").innerHTML = `
    <div class="bill-detail-meta">
      <div><span class="muted">Date</span><br><b>${formatDisplayDate(bill.date)}</b></div>
      <div><span class="muted">Party</span><br><b>${esc(partyName)}</b></div>
      <div><span class="muted">Payment</span><br><b>${bill.payMode === "cash" ? "Cash" : "Credit"}</b></div>
      <div><span class="muted">Status</span><br><b class="${due > 0 ? "neg" : "pos"}">${due > 0 ? "Unpaid" : "Paid"}</b></div>
    </div>
    <div class="bill-table-wrap card" style="margin-top:14px">
      <table class="bill-items-table">
        <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>${priceLabel}</th><th>Amount</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr><td colspan="4" style="text-align:right"><b>Total</b></td><td><b>${money(bill.total)}</b></td></tr>
          <tr><td colspan="4" style="text-align:right" class="muted">Paid</td><td>${money(bill.paid || 0)}</td></tr>
          <tr><td colspan="4" style="text-align:right" class="muted">Due</td><td class="${due > 0 ? "neg" : "pos"}">${money(due)}</td></tr>
        </tfoot>
      </table>
    </div>
    ${bill.note ? `<div class="field" style="margin-top:12px"><label>Note</label><p style="margin:4px 0 0">${esc(bill.note)}</p></div>` : ""}`;

  openModal("billDetailOverlay");
}

export function printBillDetail() {
  if (detailBillId && detailBillType) reprintBill(detailBillId, detailBillType);
}

function renderBillList(containerId, bills, type) {
  const from = document.getElementById(type === "sale" ? "salesFrom" : "purchFrom").value;
  const to = document.getElementById(type === "sale" ? "salesTo" : "purchTo").value;
  const filtered = bills.filter((b) => inRange(b.date, from, to)).slice().reverse();
  const container = document.getElementById(containerId);
  if (!filtered.length) {
    container.innerHTML = '<div class="empty">No bills in this date range.</div>';
    return;
  }

  let html = `<table class="bill-history-table"><thead><tr><th>Bill #</th><th>Date</th><th>Party</th><th>Items</th><th>Total</th><th>Paid</th><th>Due</th><th></th></tr></thead><tbody>`;
  filtered.forEach((bill) => {
    const party = db.parties.find((p) => p.id === bill.partyId);
    html += `<tr class="bill-history-row" data-bill-id="${bill.id}" data-bill-type="${type}" title="Double-click to view details">
      <td>#${bill.no}</td><td>${formatDisplayDate(bill.date)}</td><td>${esc(party?.name || bill.partyName || EM_DASH)}</td>
      <td class="bill-items-cell">${billItemsSummary(bill)}</td>
      <td>${money(bill.total)}</td><td>${money(bill.paid || 0)}</td><td>${money(bill.total - (bill.paid || 0))}</td>
      <td><div class="actions">
        <button class="btn-ghost btn-sm" data-action="reprint-bill" data-id="${bill.id}" data-type="${type}">Print</button>
        <button class="btn-ghost btn-sm" data-action="delete-bill" data-id="${bill.id}" data-type="${type}">Delete</button>
      </div></td></tr>`;
  });
  container.innerHTML = html + "</tbody></table>";
}

export function setupBillListEvents() {
  ["salesList", "purchList"].forEach((containerId) => {
    const container = document.getElementById(containerId);
    if (!container || container.dataset.dblBound) return;
    container.dataset.dblBound = "1";
    container.addEventListener("dblclick", (e) => {
      if (e.target.closest("button")) return;
      const row = e.target.closest("[data-bill-id]");
      if (!row) return;
      openBillDetail(row.dataset.billId, row.dataset.billType);
    });
  });
}

export function renderSales() { renderBillList("salesList", db.sales, "sale"); }
export function renderPurchases() { renderBillList("purchList", db.purchases, "purchase"); }
export function reprintBill(id, type) {
  const list = type === "sale" ? db.sales : db.purchases;
  const bill = list.find((b) => b.id === id);
  if (bill) printBill(bill, type);
}

export async function deleteBill(id, type) {
  if (!confirm("Delete this bill? Stock will be reversed.")) return;
  const list = type === "sale" ? db.sales : db.purchases;
  const bill = list.find((b) => b.id === id);
  reverseBillStock(bill, type);
  softDelete(type, bill);
  if (type === "sale") setSales(db.sales.filter((b) => b.id !== id));
  else setPurchases(db.purchases.filter((b) => b.id !== id));
  await saveAll();
  refresh();
  toast("Bill moved to trash.");
}

export function bindBillLineEvents(container) {
  container?.addEventListener("input", (e) => {
    const t = e.target;
    const idx = parseInt(t.dataset.index, 10);
    if (isNaN(idx) || !billItems[idx]) return;
    if (t.dataset.action === "bill-qty") {
      billItems[idx].qty = t.value;
      syncBillLineRow(idx);
    } else if (t.dataset.action === "bill-price") {
      updateBillPrice(idx, t.value);
    } else if (t.dataset.action === "bill-amount") {
      updateBillAmount(idx, t.value);
    }
  });
  container?.addEventListener("blur", (e) => {
    const t = e.target;
    const idx = parseInt(t.dataset.index, 10);
    if (isNaN(idx) || !billItems[idx]) return;
    if (t.dataset.action === "bill-qty") {
      billItems[idx].qty = Math.max(1, parseInt(t.value, 10) || 1);
      t.value = billItems[idx].qty;
      syncBillLineRow(idx);
    } else if (t.dataset.action === "bill-price") {
      const v = parseFloat(t.value);
      if (!isNaN(v) && v >= 0) t.value = v;
      updateBillPrice(idx, t.value);
    } else if (t.dataset.action === "bill-amount") {
      updateBillAmount(idx, t.value);
    }
  }, true);
  container?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "bill-remove") removeBillLine(parseInt(btn.dataset.index, 10));
  });
}

export function getBillLinesContainer() {
  return document.getElementById("billLines");
}
