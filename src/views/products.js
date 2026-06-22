import * as db from "../store/database.js";
import { softDelete, saveAll, setProducts } from "../store/database.js";
import { esc, money, uid, escCsv, downloadBlob, todayStr } from "../utils/format.js";
import { openModal, closeModal, toast } from "../utils/ui.js";
import { refresh } from "../router.js";

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

  openModal("productOverlay");
}

export function saveProduct() {
  const id = document.getElementById("productId").value;
  const name = document.getElementById("pName").value.trim();
  const costPrice = parseFloat(document.getElementById("pCost").value);
  const salePrice = parseFloat(document.getElementById("pSale").value);
  const qty = parseInt(document.getElementById("pQty").value, 10);

  if (!name) {
    alert("Enter product name.");
    return;
  }

  const duplicate = db.products.find(
    (p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== id
  );
  if (duplicate) {
    alert("Product name already exists. Use a different name.");
    return;
  }

  if (isNaN(costPrice) || costPrice < 0 || isNaN(salePrice) || salePrice < 0) {
    alert("Enter valid prices.");
    return;
  }
  if (isNaN(qty) || qty < 0) {
    alert("Enter valid quantity.");
    return;
  }

  const data = {
    name,
    category: document.getElementById("pCategory").value.trim(),
    sku: document.getElementById("pSku").value.trim(),
    costPrice,
    salePrice,
    qty,
    threshold: parseInt(document.getElementById("pThreshold").value, 10) || 0,
  };

  if (id) {
    Object.assign(db.products.find((p) => p.id === id), data);
  } else {
    db.products.push({ id: uid(), ...data });
  }

  closeModal("productOverlay");
  saveAll();
  refresh();
  toast("Product saved.");
}

export function deleteProduct(id) {
  const product = db.products.find((p) => p.id === id);
  if (!product || !confirm(`Delete "${product.name}"?`)) return;

  softDelete("product", product);
  setProducts(db.products.filter((p) => p.id !== id));
  saveAll();
  refresh();
  toast("Moved to trash.");
}

export function renderProducts() {
  const query = document.getElementById("prodSearch").value.trim().toLowerCase();
  const filter = document.getElementById("prodFilter").value;

  const rows = db.products.filter((p) => {
    const matchesQuery =
      !query ||
      p.name.toLowerCase().includes(query) ||
      (p.category || "").toLowerCase().includes(query);
    const threshold = p.threshold ?? 5;
    const matchesFilter =
      filter === "all" ||
      (filter === "low" && p.qty <= threshold) ||
      (filter === "out" && p.qty === 0);
    return matchesQuery && matchesFilter;
  });

  document.getElementById("prodCount").textContent = rows.length + " items";
  const container = document.getElementById("prodList");

  if (!rows.length) {
    container.innerHTML = '<div class="empty">No products found.</div>';
    return;
  }

  let html = `<table><thead><tr><th>Product</th><th>Purchase</th><th>Selling</th><th>Stock</th><th>Value</th><th></th></tr></thead><tbody>`;

  rows.forEach((p) => {
    const stockClass = p.qty <= (p.threshold ?? 5) ? "low" : "ok";
    html += `<tr>
      <td><b>${esc(p.name)}</b><br><span class="muted">${esc(p.category) || ""}</span></td>
      <td>${money(p.costPrice)}</td><td>${money(p.salePrice)}</td>
      <td><span class="qty-pill ${stockClass}">${p.qty}</span></td>
      <td>${money(p.qty * p.costPrice)}</td>
      <td><div class="actions">
        <button class="btn-ghost btn-sm" data-action="edit-product" data-id="${p.id}">Edit</button>
        <button class="btn-ghost btn-sm" data-action="delete-product" data-id="${p.id}">Delete</button>
      </div></td></tr>`;
  });

  container.innerHTML = html + "</tbody></table>";
}

export function exportProductsCsv() {
  if (!db.products.length) {
    toast("No products.");
    return;
  }

  const lines = [
    ["Name", "Category", "SKU", "PurchasePrice", "SellingPrice", "Qty", "StockValue"].join(","),
  ];
  db.products.forEach((p) => {
    lines.push(
      [p.name, p.category || "", p.sku || "", p.costPrice, p.salePrice, p.qty, (p.qty * p.costPrice).toFixed(2)]
        .map(escCsv)
        .join(",")
    );
  });

  downloadBlob("\uFEFF" + lines.join("\n"), "stockdesk-products-" + todayStr() + ".csv", "text/csv;charset=utf-8");
  toast("CSV exported.");
}
