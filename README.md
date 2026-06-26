# StockDesk - Business & Inventory Manager

Professional local business app: products, sales, purchases, expenses, payments, parties, reports, and printable bills.

## What changed

StockDesk now uses a **real local database file** on your PC instead of browser-only localStorage.

Main database file:

`data/stockdesk-db.json`

Automatic backups folder:

`data/backups/`

This means:
- party names, sales, products, payments, expenses, and reports are saved in one proper place
- data stays available across restarts and across days
- the app is no longer dependent on browser storage behavior
- a dated backup copy is created automatically whenever data is saved

## Daily use

Double-click **`Open StockDesk.bat`**

It will:
- start the local StockDesk server
- open your browser automatically
- load the app at `http://localhost:3210`

If you created an old desktop shortcut before, delete it and create a **new shortcut** from `Open StockDesk.bat`.

## Google Drive setup (recommended for 2 PCs)

You said you like the Google Drive idea. This is now supported well.

### Best simple setup
1. Put the full project folder inside your Google Drive folder
2. Let Google Drive fully sync it
3. On the second PC, install Google Drive and sync the same folder
4. Open the app there using `Open StockDesk.bat`

Because the app now uses:
- `data/stockdesk-db.json`
- `data/backups/`

both your live data and backups will sync through Google Drive.

### Important rule
Use **one PC at a time**.

Do not edit data on both PCs at the same time, because Google Drive may create file conflicts if the same database file changes simultaneously.

### Safe workflow
1. Finish work on PC 1
2. Wait for Google Drive to sync
3. Open app on PC 2
4. If needed, use **Backup Manager** to restore a recent backup

## Backup Manager

The app now has a **Backup Manager** button at the top.

You can:
- create a manual backup any time
- see all saved backup files
- restore a backup directly from the app

### Backup types
- **Auto backup**: created automatically on every save
- **Manual backup**: created when you click **Create Backup Now**

## Important files

- `Open StockDesk.bat` - easiest daily launcher
- `Run StockDesk Server.bat` - starts the local app server
- `data/stockdesk-db.json` - your current business data
- `data/backups/` - your backup history

## Project structure

```text
index.html
package.json
server.mjs
src/
data/
  stockdesk-db.json
  backups/
```

## First-time setup

The project already includes portable Node in `.tools/node`, so you can use the launcher without installing Node system-wide.

If `node_modules` is missing, the launcher installs dependencies automatically the first time.

## Development

```bash
npm install
npm run dev
```

## Production-style local server

```bash
npm run start
```

Then open:

`http://localhost:3210`

## Extra manual backup option

You can also manually copy these to another PC:
- `data/stockdesk-db.json`
- or any file from `data/backups/`

## GitHub

Repo:

`https://github.com/Myself7802/business-stock-management-app`
