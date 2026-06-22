let currentPage = "home";
let activeReport = "pl";
let renderCallback = null;

export function setRenderCallback(fn) {
  renderCallback = fn;
}

export function getCurrentPage() {
  return currentPage;
}

export function getActiveReport() {
  return activeReport;
}

export function setActiveReport(report) {
  activeReport = report;
}

export function navigate(page) {
  currentPage = page;
  document.querySelectorAll(".nav-btn").forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.page === page)
  );
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.getElementById("view-" + page)?.classList.add("active");
  renderCallback?.();
}

export function refresh() {
  renderCallback?.();
}
