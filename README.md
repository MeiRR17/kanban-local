# Kanban Local

A minimal, local-first Kanban board that keeps task data in your browser. No registration, synchronization service, tracking, or third-party dependencies.

## Quick start

Serve the repository directory with a static HTTP server, for example:

    python3 -m http.server 8000

Open http://localhost:8000 in a modern browser. Static hosting such as GitHub Pages also works. ES modules may not load correctly when opening the HTML directly from file://.

## Features

- **Three columns:** To do, In progress and Done.
- **Tasks:** Title, description, priority, comma-separated tags and optional due date.
- **Moving work:** Drag tasks between columns or reorder inside a column. Keyboard and screen-reader users can use **up/down** buttons to reorder within a column and **left/right** buttons to move between columns. Reorder buttons **and drag-and-drop** are disabled while filters are applied so hidden tasks do not cause surprising moves. Dropping a task on itself, before its already-adjacent next sibling, or at the end when it is already last is a true no-op: no changed timestamp, unnecessary localStorage write or spurious Undo step.
- **Editing:** Add, edit, **duplicate** or delete tasks. Duplicating creates a new ID and timestamps, keeps the original fields and may be undone. Destructive actions require confirmation.
- **Undo / redo:** Up to 30 previous board changes in the current tab session, including task edits, deletes, completed-task cleanup and imported-board replacement. Use toolbar buttons or Ctrl/⌘+Z, Ctrl/⌘+Shift+Z or Ctrl+Y when focus is not in an input.
- **Board overview:** A counts-only dashboard above the columns reports active/completed work, completion percentage, overdue deadlines, due-next-seven-days workload and active high-priority tasks. Deadline cards jump to the respective due-date filters. These counts cover the **entire board**, even when a filter is active.
- **Focus:** Filter by text, priority and due date. A **Clear filters** button resets all three selectors in one action and restores normal drag/reorder availability; it does not change task records, clear undo history or bypass an active storage-recovery safeguard. Due-date options include overdue, today, the next seven calendar days, and tasks without a date. Completed tasks are excluded from overdue/today/upcoming views, but can appear in the undated view. Column counters represent all tasks, while the toolbar shows the visible count when filtering.
- **Persistence:** Tasks save in localStorage automatically and are reloaded in the same browser. If an existing saved board cannot be parsed (including an unsupported version), it is **not automatically overwritten** by edits to the temporary empty board; a recovery warning and an explicit **Replace saved data** action are shown. This avoids silently destroying the saved bytes before the owner can recover a backup.
- **Backup:** Export all tasks to JSON or replace the board from an exported JSON file. Imports are validated and require confirmation. Backup bytes are strictly decoded as UTF-8 (rejecting malformed encoding rather than silently corrupting task text); the 1 MiB limit is checked both before and after the asynchronous read. If the board changes, a task editor opens or another import begins while a file is being read, the old import is ignored instead of replacing newer work.
- **Counts-only metrics:** A separate **Metrics** JSON export includes only total/active/completed counts, status and priority distributions, completion percentage and deadline counts for the local reporting date. It includes no task titles, descriptions, IDs, tags or individual due dates; it is not a restorable backup. Aggregate counts may still disclose operational information.
- **Visible metrics:** When search, priority or due-date filtering is active, **Visible metrics** exports a separate counts-only JSON snapshot of exactly the currently matching tasks. It uses the same local-day filtering as Visible CSV, revalidates the source board, and exposes only aggregate status/priority/deadline counts, full-board total and booleans identifying active filter kinds. It never exports query text, selected filter values, task titles, descriptions, tags, IDs or individual dates. An empty match returns zero counts. **Metrics** remains whole-board regardless of active filters. Both metric files can reveal sensitive operational counts and cannot restore tasks.
- **Calendar export:** Export the **entire board** as an iCalendar `.ics` file containing one VTODO per task. Due dates remain date-only values (no artificial timezone), status maps to `COMPLETED` or `NEEDS-ACTION` with the original Kanban status preserved in an extension property, and priority maps to iCalendar's 1/5/9 scale. Titles, descriptions and tags are escaped as iCalendar text; UTF-8 lines are folded at the 75-octet limit without splitting Unicode characters. This is a full-detail export regardless of filters, can disclose confidential task content, and is not a restorable Kanban backup. Tasks without due dates are still exported without a DUE property.
- **Tasks CSV:** Explicitly export the **entire board**, regardless of active search or due/priority filters, with task ID, title, description, status, priority, tags, due date, creation and update timestamps. Export uses UTF-8 with BOM, quoted CSV fields, and text-prefix neutralization for cells that spreadsheet viewers could interpret as formulas (including after leading whitespace). Multiline descriptions remain quoted. This is a full-data **sensitive** export and is **not an importable backup**: use JSON Export to preserve a restorable board. No task data is sent to a remote service.
- **Visible CSV:** When at least one search, priority or due-date filter is active, the **Visible CSV** button exports **only tasks currently matching those filters**, in board order. It runs the same filter logic used by the three columns, with the browser's local calendar date captured at export time; a filter matching no tasks produces a header-only CSV. The button is disabled with no active filters, and clearing filters disables it again. Full **Tasks CSV** and the restorable **JSON Export** always keep their original, whole-board behavior. Visible CSV uses the same validated CSV cells and spreadsheet-formula precautions as Tasks CSV. Both task CSV files may contain confidential descriptions and are not anonymized or importable backups.
- **Cleanup:** Remove completed tasks after confirming.

## Privacy and limitations

Tasks are not sent to a server; the app makes no network requests except any normal static resource requests made by the host page.

If the stored board is unreadable, new edits and imports remain in memory until the user explicitly confirms replacing the storage entry. Export the current board as JSON and try recovering a previous backup before confirming: replacement is destructive and not undoable. If browser storage is entirely unavailable, the app continues in memory and saving will report an error.

Undo/redo history is **in memory only**, not part of the exported board JSON or localStorage. It disappears when the tab reloads or closes. Export a JSON backup to protect important task changes. Data is stored in your current browser profile and may disappear if storage is cleared or private browsing closes. **Export regularly.** There is no cross-device synchronization. Due-date comparisons use the browser's local calendar date; **Next 7 days** means today plus the next six calendar days, not the next 168 hours.

The metrics export always covers the **entire current board**, regardless of search/priority/due filters; unlike the full backup it cannot be imported to recover lost tasks. A board contains at most 500 tasks. Each task allows a 120-character title, 3,000-character description, and 12 tags of up to 24 characters each. JSON imports are limited to 1 MB. The exported format is versioned (`version: 1`). Importing a file **replaces**, rather than merges, the existing board.

This is a code implementation awaiting the owner's centralized validation cycle; automated tests have not been run.

## Source structure

- `index.html` — responsive board and task-editor dialog
- `styles.css` — layout, task cards, accessibility states
- `app.js` — local UI, drag/drop, filters, import/export
- `src/board.js` — pure task model, validation and persistence
- `src/filters.js` — pure local-calendar search, priority and due-date filters
- `src/overview.js` — aggregate progress and due-date counters without task details
- `src/summary.js` — isolated whole-board and filtered counts-only metrics JSON exports, without individual task records or filter values
- `src/tasks-csv.js` — local full-board CSV export with conservative spreadsheet-formula neutralization
- `src/tasks-ics.js` — local full-board iCalendar VTODO export with date-only deadlines and UTF-8 line folding
- `LICENSE` — MIT

## Author

Built by Meir Dvir · https://github.com/MeiRR17
