import * as db from "../store/database.js";
import { restoreFromTrash, purgeFromTrash } from "../services/trash.js";
import { esc, money } from "../utils/format.js";
import { refresh } from "../router.js";

export function renderTrash() {
  const container = document.getElementById("trashList");
  if (!db.trash.length) {
    container.innerHTML = '<div class="empty">Trash is empty.</div>';
    return;
  }
  let html = `<table><thead><tr><th>Deleted</th><th>Type</th><th>Details</th><th></th></tr></thead><tbody>`;
  db.trash.slice().reverse().forEach((item) => {
    const data = item.data;
    const detail = data.name || (data.no ? "Bill #" + data.no : "") || (data.amount ? money(data.amount) : "") || "—";
    html += `<tr>
      <td class="muted">${new Date(item.deletedAt).toLocaleString("en-IN")}</td>
      <td>${item.kind}</td><td>${esc(detail)}</td>
      <td><div class="actions">
        <button class="btn-green btn-sm" data-action="restore-trash" data-id="${item.id}">Restore</button>
        <button class="btn-red btn-sm" data-action="purge-trash" data-id="${item.id}">Delete forever</button>
      </div></td></tr>`;
  });
  container.innerHTML = html + "</tbody></table>";
}

export async function handleRestore(trashId) {
  await restoreFromTrash(trashId);
  refresh();
}

export async function handlePurge(trashId) {
  await purgeFromTrash(trashId);
  refresh();
}
