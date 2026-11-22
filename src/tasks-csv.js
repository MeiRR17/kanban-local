/**
 * Explicit, non-restorable spreadsheet export of all current Kanban tasks.
 * The JSON backup remains the only supported import format.
 *
 * Spreadsheet viewers can execute CSV cells that resemble formulas. Quote
 * every field and prefix potentially executable user text with apostrophe.
 * Cells may contain CR/LF (descriptions), which are quoted per RFC 4180.
 */
const STATUSES = new Set(['todo', 'doing', 'done']);
const PRIORITIES = new Set(['low', 'medium', 'high']);
const HEADERS = Object.freeze([
  'id', 'title', 'description', 'status', 'priority', 'tags',
  'due_date', 'created_at', 'updated_at',
]);

function cell(value) {
  let text = String(value ?? '');
  // Some spreadsheet apps ignore leading whitespace or invisible marks when
  // interpreting formulas. A leading apostrophe forces a text cell.
  if (/^[\s\u200B\u200E\u200F\uFEFF]*[=+\-@]/u.test(text) ||
      /^[\t\r\n]/u.test(text)) {
    text = "'" + text;
  }
  return '"' + text.replaceAll('"', '""') + '"';
}

export function boardTasksCsv(board) {
  if (!board || board.version !== 1 || !Array.isArray(board.tasks) ||
      board.tasks.length > 500) {
    throw new TypeError('Expected a bounded version-1 Kanban board.');
  }
  const lines = [HEADERS.map(cell).join(',')];
  for (const task of board.tasks) {
    if (!task || typeof task !== 'object' || Array.isArray(task) ||
        !STATUSES.has(task.status) || !PRIORITIES.has(task.priority) ||
        !Array.isArray(task.tags) || task.tags.length > 12 ||
        !task.tags.every(tag => typeof tag === 'string' && tag.length <= 24) ||
        !['id', 'title', 'description', 'due', 'createdAt', 'updatedAt']
          .every(key => typeof task[key] === 'string') ||
        task.title.length > 120 || task.description.length > 3000 ||
        task.id.length > 100 || !task.id ||
        task.due.length > 10 || task.createdAt.length > 48 ||
        task.updatedAt.length > 48) {
      throw new TypeError('Invalid task encountered during spreadsheet export.');
    }
    lines.push([
      task.id, task.title, task.description, task.status, task.priority,
      task.tags.join('; '), task.due, task.createdAt, task.updatedAt,
    ].map(cell).join(','));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
