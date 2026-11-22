/**
 * Local-first Kanban data model. All user data stays in this browser.
 * This module has no dependency on the UI and makes no network requests.
 */
export const STORAGE_KEY = 'kanban-local:v1';
export const STATUSES = Object.freeze([
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'In progress' },
  { id: 'done', label: 'Done' },
]);
export const PRIORITIES = Object.freeze(['low', 'medium', 'high']);
const validStatuses = new Set(STATUSES.map(s => s.id));
const validPriorities = new Set(PRIORITIES);
const MAX_TASKS = 500;
const MAX_IMPORT_BYTES = 1024 * 1024;

function uid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function emptyBoard() {
  return { version: 1, tasks: [] };
}

function cleanText(value, max, required = false) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new Error('A task title is required.');
  if (text.length > max) throw new Error('Text exceeds the ' + max + '-character limit.');
  return text;
}

function cleanDate(value) {
  if (value === '' || value == null) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Due date must use YYYY-MM-DD.');
  }
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Due date is not a real calendar date.');
  }
  return value;
}

function cleanTags(value) {
  const array = Array.isArray(value) ? value : String(value ?? '').split(',');
  if (array.length > 12) throw new Error('At most 12 tags are allowed.');
  const tags = Array.from(new Set(array.map(t => cleanText(t, 24)).filter(Boolean)));
  return tags;
}

function cleanTask(input, preserveMeta = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Every task must be an object.');
  }
  const status = input.status ?? 'todo';
  const priority = input.priority ?? 'medium';
  if (!validStatuses.has(status)) throw new Error('Unknown task status.');
  if (!validPriorities.has(priority)) throw new Error('Unknown task priority.');
  const now = new Date().toISOString();
  return {
    id: preserveMeta ? cleanText(input.id, 100, true) : uid(),
    title: cleanText(input.title, 120, true),
    description: cleanText(input.description, 3000),
    status,
    priority,
    tags: cleanTags(input.tags),
    due: cleanDate(input.due),
    createdAt: preserveMeta ? cleanText(input.createdAt, 48, true) : now,
    updatedAt: preserveMeta ? cleanText(input.updatedAt, 48, true) : now,
  };
}

/** Parse an exported board, rejecting malformed or oversized content. */
export function parseBoard(json) {
  if (typeof json !== 'string' || json.length > MAX_IMPORT_BYTES) {
    throw new Error('Choose a JSON board file under 1 MB.');
  }
  let value;
  try { value = JSON.parse(json); } catch { throw new Error('The file is not valid JSON.'); }
  if (!value || value.version !== 1 || !Array.isArray(value.tasks)) {
    throw new Error('Unsupported board format. Expected version 1 with a tasks array.');
  }
  if (value.tasks.length > MAX_TASKS) throw new Error('Board exceeds 500 tasks.');
  const tasks = value.tasks.map(task => cleanTask(task, true));
  const ids = new Set(tasks.map(t => t.id));
  if (ids.size !== tasks.length) throw new Error('Board contains duplicate task IDs.');
  return { version: 1, tasks };
}

export function serializeBoard(board) {
  return JSON.stringify({ version: 1, tasks: board.tasks }, null, 2) + '\n';
}

export function addTask(board, input) {
  if (board.tasks.length >= MAX_TASKS) throw new Error('The board is limited to 500 tasks.');
  const task = cleanTask(input);
  return { board: { ...board, tasks: [...board.tasks, task] }, task };
}

export function editTask(board, id, input) {
  if (!board.tasks.some(t => t.id === id)) throw new Error('Task not found.');
  const tasks = board.tasks.map(task => {
    if (task.id !== id) return task;
    const updated = cleanTask({ ...task, ...input }, true);
    return { ...updated, id, createdAt: task.createdAt, updatedAt: new Date().toISOString() };
  });
  return { ...board, tasks };
}

export function deleteTask(board, id) {
  return { ...board, tasks: board.tasks.filter(t => t.id !== id) };
}

/**
 * Move a task to a column. Optional beforeId moves it ahead of a task in
 * that column; omitted means append to the column's end.
 */
export function moveTask(board, id, status, beforeId = null) {
  if (!validStatuses.has(status)) throw new Error('Unknown column.');
  const task = board.tasks.find(t => t.id === id);
  if (!task) throw new Error('Task not found.');
  if (beforeId != null && beforeId !== id) {
    const target = board.tasks.find(t => t.id === beforeId);
    if (!target || target.status !== status) throw new Error('Invalid drop destination.');
  }
  const moved = { ...task, status, updatedAt: new Date().toISOString() };
  const tasks = board.tasks.filter(t => t.id !== id);
  const index = beforeId && beforeId !== id
    ? tasks.findIndex(t => t.id === beforeId)
    : -1;
  if (index < 0) tasks.push(moved);
  else tasks.splice(index, 0, moved);
  return { ...board, tasks };
}

export function readStoredBoard(storage = localStorage) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return {
      board: emptyBoard(),
      warning: 'Browser storage is unavailable. Changes cannot be saved here; export a JSON backup.',
      recoveryRequired: false,
    };
  }
  if (raw === null) return { board: emptyBoard(), warning: '', recoveryRequired: false };
  try {
    return { board: parseBoard(raw), warning: '', recoveryRequired: false };
  } catch {
    // Do not overwrite malformed or newer-version stored data while a user
    // edits the temporary empty board. They may still recover it externally.
    return {
      board: emptyBoard(),
      warning: 'Existing saved board is unreadable. Its data is protected from automatic overwrite. Import a valid backup or export the current board, then explicitly approve replacement.',
      recoveryRequired: true,
    };
  }
}

export function storeBoard(board, storage = localStorage) {
  storage.setItem(STORAGE_KEY, serializeBoard(board));
  return board;
}
