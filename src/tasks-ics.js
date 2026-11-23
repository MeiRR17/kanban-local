/**
 * iCalendar VTODO export for the full Kanban board.
 * Export is explicit and contains task details; it is not an importable backup.
 */
const STATUSES = new Set(['todo', 'doing', 'done']);
const PRIORITIES = Object.freeze({ high: 1, medium: 5, low: 9 });
const MAX_TASKS = 500;

function escapeText(value) {
  return String(value ?? '')
    .replace(/\\/gu, '\\\\')
    .replace(/\r\n|\r|\n/gu, '\\n')
    .replace(/,/gu, '\\,')
    .replace(/;/gu, '\\;');
}

/** Fold content lines at 75 UTF-8 octets without splitting a code point. */
function foldLine(line) {
  const output = [];
  let current = '';
  let bytes = 0;
  for (const character of line) {
    const width = new TextEncoder().encode(character).length;
    if (bytes + width > 75 && current) {
      output.push(current);
      current = ' ' + character;
      bytes = 1 + width; // The continuation whitespace is an octet.
    } else {
      current += character;
      bytes += width;
    }
  }
  output.push(current);
  return output.join('\r\n');
}

function utcStamp(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError('A valid export timestamp is required.');
  }
  return date.toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}/u, '');
}
function dateOnly(value) {
  if (!value) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
      new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) {
    throw new TypeError('A task has an invalid due date.');
  }
  return value.replace(/-/gu, '');
}
function uidFor(id) {
  const bytes = new TextEncoder().encode(id);
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return hex + '@kanban-local';
}

export function boardTasksIcs(board, now = new Date()) {
  if (!board || board.version !== 1 || !Array.isArray(board.tasks) ||
      board.tasks.length > MAX_TASKS) {
    throw new TypeError('Expected a bounded version-1 Kanban board.');
  }
  const stamp = utcStamp(now);
  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//MeiRR17//Kanban Local//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const task of board.tasks) {
    if (!task || typeof task !== 'object' || Array.isArray(task) ||
        typeof task.id !== 'string' || !task.id || task.id.length > 100 ||
        typeof task.title !== 'string' || task.title.length > 120 ||
        typeof task.description !== 'string' || task.description.length > 3000 ||
        !STATUSES.has(task.status) || !Object.hasOwn(PRIORITIES, task.priority) ||
        !Array.isArray(task.tags) || task.tags.length > 12 ||
        !task.tags.every(tag => typeof tag === 'string' && tag.length <= 24) ||
        typeof task.due !== 'string' || task.due.length > 10) {
      throw new TypeError('Invalid task encountered during calendar export.');
    }
    lines.push('BEGIN:VTODO');
    lines.push('UID:' + uidFor(task.id));
    lines.push('DTSTAMP:' + stamp);
    lines.push('SUMMARY:' + escapeText(task.title));
    if (task.description) lines.push('DESCRIPTION:' + escapeText(task.description));
    for (const tag of task.tags) lines.push('CATEGORIES:' + escapeText(tag));
    if (task.due) lines.push('DUE;VALUE=DATE:' + dateOnly(task.due));
    lines.push('PRIORITY:' + PRIORITIES[task.priority]);
    lines.push('STATUS:' + (task.status === 'done' ? 'COMPLETED' : 'NEEDS-ACTION'));
    lines.push('X-KANBAN-STATUS:' + task.status.toUpperCase());
    if (task.status === 'done') lines.push('PERCENT-COMPLETE:100');
    lines.push('END:VTODO');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
