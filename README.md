# Kanban Local

A minimal, local-first Kanban board that keeps task data in your browser. No registration, synchronization service, tracking, or third-party dependencies.

## Quick start

Serve the repository directory with a static HTTP server, for example:

    python3 -m http.server 8000

Open http://localhost:8000 in a modern browser. Static hosting such as GitHub Pages also works. ES modules may not load correctly when opening the HTML directly from file://.

## Features

- **Three columns:** To do, In progress and Done.
- **Tasks:** Title, description, priority, comma-separated tags and optional due date.
- **Moving work:** Drag tasks between columns or reorder inside a column. Keyboard and screen-reader users can use **up/down** buttons to reorder within a column and **left/right** buttons to move between columns. Reorder buttons **and drag-and-drop** are disabled while filters are applied so hidden tasks do not cause surprising moves.
- **Editing:** Add, edit, **duplicate** or delete tasks. Duplicating creates a new ID and timestamps, keeps the original fields and may be undone. Destructive actions require confirmation.
- **Undo / redo:** Up to 30 previous board changes in the current tab session, including task edits, deletes, completed-task cleanup and imported-board replacement. Use toolbar buttons or Ctrl/⌘+Z, Ctrl/⌘+Shift+Z or Ctrl+Y when focus is not in an input.
- **Board overview:** A counts-only dashboard above the columns reports active/completed work, completion percentage, overdue deadlines, due-next-seven-days workload and active high-priority tasks. Deadline cards jump to the respective due-date filters. These counts cover the **entire board**, even when a filter is active.
- **Focus:** Filter by text, priority and due date. Due-date options include overdue, today, the next seven calendar days, and tasks without a date. Completed tasks are excluded from overdue/today/upcoming views, but can appear in the undated view. Column counters represent all tasks, while the toolbar shows the visible count when filtering.
- **Persistence:** Tasks save in localStorage automatically and are reloaded in the same browser. If an existing saved board cannot be parsed (including an unsupported version), it is **not automatically overwritten** by edits to the temporary empty board; a recovery warning and an explicit **Replace saved data** action are shown. This avoids silently destroying the saved bytes before the owner can recover a backup.
- **Backup:** Export all tasks to JSON or replace the board from an exported JSON file. Imports are validated and require confirmation. If the board changes, a task editor opens or another import begins while a file is being read, the old import is ignored instead of replacing newer work.
- **Cleanup:** Remove completed tasks after confirming.

## Privacy and limitations

Tasks are not sent to a server; the app makes no network requests except any normal static resource requests made by the host page.

If the stored board is unreadable, new edits and imports remain in memory until the user explicitly confirms replacing the storage entry. Export the current board as JSON and try recovering a previous backup before confirming: replacement is destructive and not undoable. If browser storage is entirely unavailable, the app continues in memory and saving will report an error.

Undo/redo history is **in memory only**, not part of the exported board JSON or localStorage. It disappears when the tab reloads or closes. Export a JSON backup to protect important task changes. Data is stored in your current browser profile and may disappear if storage is cleared or private browsing closes. **Export regularly.** There is no cross-device synchronization. Due-date comparisons use the browser's local calendar date; **Next 7 days** means today plus the next six calendar days, not the next 168 hours.

A board contains at most 500 tasks. Each task allows a 120-character title, 3,000-character description, and 12 tags of up to 24 characters each. JSON imports are limited to 1 MB. The exported format is versioned (`version: 1`). Importing a file **replaces**, rather than merges, the existing board.

This is a code implementation awaiting the owner's centralized validation cycle; automated tests have not been run.

## Source structure

- `index.html` — responsive board and task-editor dialog
- `styles.css` — layout, task cards, accessibility states
- `app.js` — local UI, drag/drop, filters, import/export
- `src/board.js` — pure task model, validation and persistence
- `src/filters.js` — pure local-calendar search, priority and due-date filters
- `src/overview.js` — aggregate progress and due-date counters without task details
- `LICENSE` — MIT

## Author

Built by Meir Dvir · https://github.com/MeiRR17
