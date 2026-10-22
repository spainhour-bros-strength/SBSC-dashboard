# Spainhour Bros Strength Co. — Internal Dashboard

The internal web dashboard for Spainhour Bros Strength Co. (SBSC). It runs entirely in the browser as plain HTML, CSS and JavaScript, so it needs no build step, no server and no monthly cost.

This project is fully independent. It shares no code, data or accounts with any other dashboard.

## What's inside

| Tab | What it does |
|---|---|
| **Home** | Active members, estimated monthly revenue, sessions this week, jump-test activity, readiness flags, renewals due |
| **Program Library** | Every program and template. **Upload your finished program PDFs** (drag in several at once): each becomes a library entry with a cover thumbnail, which you can view, download and assign to clients. Built programs can also have their PDF attached. Includes duplicate, export/import, branded printing, and the **Exercise Library** (~90 exercises by category, editable) |
| **Program Builder** | Build programs as phases, then days, then exercises (label, sets, reps, tempo, rest, load, notes). Supports supersets (2A / 2B), duplicating days and phases, and renumbering. Saves automatically |
| **ForceDecks** | Import VALD ForceDecks CSV exports and keep **every metric in the file**. **Team View** shows latest results, readiness, a quadrant profile with any two metrics, and a ranking. **Athlete Report** shows key-metric cards with change vs previous, a readiness score, a trend chart for any metric (with comparison), percentile vs the group, session history, and an all-metrics table with PBs. **All Tests** shows the raw data with CSV export |
| **Clients** | Roster with search and filters. Each profile has contact and guardian info, membership, assigned program with week progress, jump snapshot, sessions and attendance, and timestamped coach notes |
| **Memberships** | Membership plans (monthly, weekly, annual, packs), members per plan, estimated revenue, a renewal tracker and a one-click "Renewed" button |
| **Schedule & Sign-Up** | Month calendar and upcoming list. Create sessions (with weekly repeats), set capacity, sign clients up (automatic waitlist when full), and take attendance |
| **Settings & Backup** | Download or restore a full backup, load or remove demo data, set coach names |

## Where the data lives (important)

**Client data is never stored in this repo.** Everything you enter, including clients, jump tests, programs and sessions, is saved in your browser's local storage on the device you're using. This means:

- The repo can be public without exposing any client information.
- A different computer or browser starts empty. Use **Settings → Download backup**, then **Restore from backup** on the other device.
- Clearing your browser's site data erases the dashboard's data. **Back up weekly.**
- Uploaded program PDFs are stored in the same browser (IndexedDB) and are **included in the backup file**, so restoring on another computer brings them along. Backups get larger as you add PDFs.
- Never commit backups (`*.json`) or ForceDecks exports (`*.csv`) to the repo. The `.gitignore` already blocks them.

## Put it on GitHub (one-time setup)

1. **Create a GitHub organization for the business** (free): github.com → your profile picture → *Your organizations* → *New organization* → Free plan. Suggested name: `spainhour-bros-strength`.
2. **Create a repository** in that organization: *New repository* → name it `SBSC-Dashboard` → Public → don't add a README (this folder already has one).
3. **Upload the files.** On the new empty repo page, click *uploading an existing file*, select **all the files** in this folder, drag them in, and click *Commit changes*.
   - If you use the command line instead:
     ```bash
     cd SBSC-Dashboard
     git init && git add . && git commit -m "Initial SBSC dashboard"
     git branch -M main
     git remote add origin https://github.com/spainhour-bros-strength/SBSC-Dashboard.git
     git push -u origin main
     ```
4. **Turn on GitHub Pages:** repo → *Settings* → *Pages* → *Source: Deploy from a branch* → *Branch: main / (root)* → *Save*. After about a minute the dashboard is live at
   `https://spainhour-bros-strength.github.io/SBSC-Dashboard/`
5. Bookmark that link on each device you coach from.

> You can also use it without GitHub: double-click `index.html` and it opens in your browser.

## Trying it out

- Go to **Settings → Load demo data** to fill every tab with fake clients, six weeks of jump tests and two weeks of sessions. Remove it in one click when you're done.
- `forcedecks-sample.csv` is a fake ForceDecks export (4 sample athletes, 3 weekly tests) for testing the import.

## Importing ForceDecks data

In ForceDecks: **Results → select tests → Export → CSV**. Then in the dashboard: **ForceDecks → Import CSV** (you can select several files at once).

- Names are matched to existing clients automatically. Unmatched names can become new clients or be skipped.
- If a client's name is spelled differently in ForceDecks, it's remembered after the first import.
- Multiple trials on the same day are averaged into one session.
- Re-importing the same file skips duplicates.
- **Readiness** compares the latest RSI-modified (or jump height if RSI-mod isn't in the export) to the athlete's previous 6 sessions: **Ready** ≥ −5%, **Monitor** −5 to −10%, **Fatigued** < −10%. It needs 3 sessions before it scores.

## Project structure

Every file sits at the top level. There are no folders, so uploading through GitHub's website can't break the layout.

```
index.html            App shell
styles.css            SBSC design system (black / orange / paper)
store.js              Local data store, backup / restore
ui.js                 Shared helpers: modals, tables, CSV parsing, charts, dates
files.js              PDF storage (IndexedDB), cover thumbnails, backup of files
seed.js               Exercise library, starter program, demo data
app.js                Navigation and routing
home.js, programs.js, builder.js, forcedecks.js,
clients.js, memberships.js, schedule.js, settings.js   One file per tab
*.ttf                 Brand fonts (Bebas Neue, Oswald, Barlow; open licence)
logo.png, logo-black.png, favicon.png
chart.umd.min.js      Chart.js 4.6.1 (bundled)
pdf.min.js, pdf.worker.min.js   pdf.js 3.11 for PDF cover thumbnails (bundled)
forcedecks-sample.csv Fake ForceDecks export for testing
```

## Updating the live site

Download the new zip, extract it, select **all** the files, and drag them into **Add file → Upload files** on GitHub, then **Commit changes**. Files with the same name are replaced. Wait about 2 minutes, then press **Ctrl + Shift + R** on the dashboard.

## Roadmap: when you outgrow one-device storage

The next step for multi-coach access, client logins, online self sign-up and payments is a hosted backend:

1. **Supabase** (free tier) for a real database and logins, so every coach sees the same data on any device. Replace `store.js` with Supabase calls. The views won't need to change much.
2. **Client portal:** a separate public page where clients book sessions and see their own program and jump reports. This needs the logins from step 1.
3. **Payments:** connect Stripe (or keep your current processor) and sync renewal status automatically instead of clicking "Renewed".
4. **Hosting with access control:** move the internal dashboard to Cloudflare Pages + Cloudflare Access (free for up to 50 users) so only approved emails can open it.
