# StockDesk — Business & Inventory Manager

Professional local business app: products, sales, purchases, expenses, payments, parties, reports, and printable bills. Data stays on your PC in the browser.

## Project structure

```
stockdesk/
├── index.html              # App shell (HTML only)
├── package.json            # Dependencies & scripts
├── vite.config.js          # Build tool config
├── src/
│   ├── main.js             # Entry point — wires everything together
│   ├── config/
│   │   └── constants.js    # App name, currency, storage keys
│   ├── store/
│   │   └── database.js     # State + localStorage load/save/migrate
│   ├── services/
│   │   ├── parties.js      # Balance calculations
│   │   ├── reports.js      # P&L and party statements
│   │   ├── backup.js       # Export / import backup files
│   │   ├── print.js        # Bill & statement printing
│   │   └── trash.js        # Soft delete / restore logic
│   ├── views/
│   │   ├── home.js         # Dashboard
│   │   ├── products.js     # Product CRUD
│   │   ├── parties.js      # Customer / supplier CRUD
│   │   ├── bills.js        # Sales & purchase billing
│   │   ├── expenses.js
│   │   ├── payments.js
│   │   ├── reports.js
│   │   └── trash.js
│   ├── utils/
│   │   ├── format.js       # money(), dates, CSV helpers
│   │   └── ui.js           # Toast, modals, date filters
│   └── styles/
│       └── main.css        # All styles
└── dist/                   # Built app (after npm run build)
```

This is a **proper modular codebase** — not one giant HTML file. Each file has one job.

## Requirements

- [Node.js 18+](https://nodejs.org/) (for development and building)
- A modern browser (Chrome or Edge recommended)

## Quick start (development)

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Run locally without dev server (production build)

```bash
npm install
npm run build
npm run preview
```

Or open `dist/index.html` after build — for best results use `npm run preview` which serves the built files correctly.

> **Note:** The old “double-click one HTML file” workflow is replaced by a proper build step. This is standard for real projects and keeps code maintainable.

## Features

- **Home** — Sale / Purchase / Expense quick actions + dashboard
- **Products** — purchase + selling price, duplicate name block, stock alerts
- **Parties** — customers & suppliers with running balance
- **Sales / Purchases** — autocomplete products, both prices on bill, print receipt
- **Expenses** — track business costs
- **Payments In/Out** — money received / paid against parties
- **Reports** — Profit/Loss and Party Statement (CSV + Print → PDF)
- **Trash** — restore mistakenly deleted records
- **Backup / Restore** — move all data to another PC via JSON file

## Data storage

All data is saved in the browser **localStorage** on this PC. Use **Backup** regularly.

## Push to GitHub (myself7802)

Remote is already set to: **https://github.com/myself7802/stockdesk**

### Step 1 — Create empty repo on GitHub (one time)

1. Open [github.com/new](https://github.com/new)
2. **Repository name:** `stockdesk`
3. **Public**
4. **Do not** add README, .gitignore, or license (this project already has them)
5. Click **Create repository**

### Step 2 — Push from your PC

Double-click **`push-to-github.bat`**

Or in terminal:

```bash
git push -u origin main
```

Sign in when GitHub asks (browser or token). After success:

**https://github.com/myself7802/stockdesk**

## License

MIT — use freely for your business.
