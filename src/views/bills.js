import * as db from "../store/database.js";
import { softDelete, saveAll, nextBillNo, setSales, setPurchases } from "../store/database.js";
import { printBill } from "../services/print.js";
import { reverseBillStock } from "../services/trash.js";
import { esc, money, uid, todayStr, inRange } from "../utils/format.js";
import { openModal, closeModal, fillPartySelect, toast } from "../utils/ui.js";
import { navigate, refresh } from "../router.js";

/** @type {import('../types.js').BillLine[]} */
let billItems = [];

export function openBillForm(type) {
  document.getElementById("billType").value = type;
  document.getElementById("billModalTitle").textContent = type === "sale" ? "New Sale" : "New Purchase";
  document.getElementById("billDate").value = todayStr();
  document.getElementById("billPaid").value = 0;
  document.getElementById("billNote").value = "";
  document.getElementById("billProductSearch").value = "";
  billItems = [];
  fillPartySelect("billParty", type === "sale" ? "customer" : "supplier");
  renderBillLines();
  openModal("billOverlay");
}

function renderBillLines() {
  const type = document.getElementById("billType").value;
  const container = document.getElementById("billLines");

  if (!billItems.length) {
    container.innerHTML =
      '<div class="muted" style="padding:8px">No items yet. Search and add products above.</div>';
    document.getElementById("billTotal").textContent = money(0);
    return;
  }

  let total = 0;
  let html = "";

  billItems.forEach((item, index) => {
    const lineTotal = item.qty * (type === "sale" ? item.salePrice : item.costPrice);
    total += lineTotal;
    html += `<div class="bill-line">
      <span><b>${esc(item.name)}</b></span>
      <span>${money(item.costPrice)}</span><span>${money(item.salePrice)}</span>
      <span><input type="number" min="1" value="${item.qty}" style="width:60px;padding:4px" data-action="bill-qty" data-index="${index}" /></span>
      <span>${money(lineTotal)}</span>
      <span><button class="btn-ghost btn-sm" data-action="bill-remove" data-index="${index}">×</button></span>
    </div>`;
  });

  container.innerHTML = html;
  document.getElementById("billTotal").textContent = money(total);
}

export function updateBillQty(index, value) {
  billItems[index].qty = Math.max(1, parseInt(value, 10) || 1);
  renderBillLines();
}

export function removeBillLine(index) {
  billItems.splice(index, 1);
  renderBillLines();
}

export function setupBillAutocomplete() {
  const input = document.getElementById("billProductSearch");
  const list = document.getElementById("billAcList");

  input.oninput = () => {
    const query = input.value.trim().toLowerCase();
    if (!query) {
      list.classList.remove("show");
      return;
    }

    const matches = db.products.filter((p) => p.name.toLowerCase().includes(query)).slice(0, 8);
    if (!matches.length) {
      list.innerHTML = '<div class="ac-item muted">No match</div>';
      list.classList.add("show");
      return;
    }

    list.innerHTML = matches
      .map(
        (p) =>
          `<div class="ac-item" data-action="bill-add-product" data-id="${p.id}">${esc(p.name)} — Buy ${money(p.costPrice)} / Sell ${money(p.salePrice)} (Stock: ${p.qty})</div>`
      )
      .join("");
    list.classList.add("show");
  };

  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      list.querySelector(".ac-item[data-id]")?.click();
    }
  };

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-wrap")) list.classList.remove("show");
  });
}

export function addProductToBill(productId) {
  const product = db.products.find((p) => p.id === productId);
  if (!product) return;

  const existing = billItems.find((item) => item.productId === productId);
  if (existing) {
    existing.qty++;
  } else {
    billItems.push({
      productId: product.id,
      name: product.name,
      costPrice: product.costPrice,
      salePrice: product.salePrice,
      qty: 1,
    });
  }

  document.getElementById("billProductSearch").value = "";
  document.getElementById("billAcList").classList.remove("show");
  renderBillLines();
}

export function saveBill() {
  const type = document.getElementById("billType").value;
  const partyId = document.getElementById("billParty").value;
  const date = document.getElementById("billDate").value;
  const paid = parseFloat(document.getElementById("billPaid").value) || 0;
  const note = document.getElementById("billNote").value.trim();

  if (!partyId) {
    alert("Select a party.");
    return;
  }
  if (!billItems.length) {
    alert("Add at least one product.");
    return;
  }

  for (const item of billItems) {
    const product = db.products.find((p) => p.id === item.productId);
    if (type === "sale" && product.qty < item.qty) {
      alert(`Not enough stock for ${product.name}. Available: ${product.qty}`);
      return;
    }
  }

  const total = billItems.reduce(
    (sum, item) => sum + item.qty * (type === "sale" ? item.salePrice : item.costPrice),
    0
  );

  const bill = {
    id: uid(),
    no: nextBillNo(type),
    date,
    partyId,
    items: billItems.map((item) => ({ ...item })),
    total,
    paid,
    note,
    createdAt: Date.now(),
  };

  billItems.forEach((item) => {
    const product = db.products.find((p) => p.id === item.productId);
    if (type === "sale") product.qty -= item.qty;
    else product.qty += item.qty;
  });

  if (type === "sale") db.sales.push(bill);
  else db.purchases.push(bill);

  closeModal("billOverlay");
  saveAll();
  printBill(bill, type);
  navigate(type === "sale" ? "sales" : "purchases");
  toast((type === "sale" ? "Sale" : "Purchase") + " bill saved.");
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

  let html = `<table><thead><tr><th>Bill #</th><th>Date</th><th>Party</th><th>Total</th><th>Paid</th><th>Due</th><th></th></tr></thead><tbody>`;

  filtered.forEach((bill) => {
    const party = db.parties.find((p) => p.id === bill.partyId);
    html += `<tr>
      <td>#${bill.no}</td><td>${bill.date}</td><td>${esc(party?.name || "—")}</td>
      <td>${money(bill.total)}</td><td>${money(bill.paid || 0)}</td><td>${money(bill.total - (bill.paid || 0))}</td>
      <td><div class="actions">
        <button class="btn-ghost btn-sm" data-action="reprint-bill" data-id="${bill.id}" data-type="${type}">Print</button>
        <button class="btn-ghost btn-sm" data-action="delete-bill" data-id="${bill.id}" data-type="${type}">Delete</button>
      </div></td></tr>`;
  });

  container.innerHTML = html + "</tbody></table>";
}

export function renderSales() {
  renderBillList("salesList", db.sales, "sale");
}

export function renderPurchases() {
  renderBillList("purchList", db.purchases, "purchase");
}

export function reprintBill(id, type) {
  const list = type === "sale" ? db.sales : db.purchases;
  const bill = list.find((b) => b.id === id);
  if (bill) printBill(bill, type);
}

export function deleteBill(id, type) {
  if (!confirm("Delete this bill? Stock will be reversed.")) return;

  const list = type === "sale" ? db.sales : db.purchases;
  const bill = list.find((b) => b.id === id);
  reverseBillStock(bill, type);
  softDelete(type, bill);

  if (type === "sale") setSales(db.sales.filter((b) => b.id !== id));
  else setPurchases(db.purchases.filter((b) => b.id !== id));

  saveAll();
  refresh();
  toast("Bill moved to trash.");
}

/** Wire bill line events after render */
export function bindBillLineEvents(container) {
  container?.addEventListener("input", (e) => {
    if (e.target.dataset.action === "bill-qty") {
      updateBillQty(parseInt(e.target.dataset.index, 10), e.target.value);
    }
  });
  container?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "bill-remove") removeBillLine(parseInt(btn.dataset.index, 10));
    if (btn.dataset.action === "bill-add-product") addProductToBill(btn.dataset.id);
  });
}

export function getBillLinesContainer() {
  return document.getElementById("billLines");
}
