/**
 * Pure, local-calendar due-date filtering for Kanban tasks.
 *
 * "Next 7 days" includes today and the following six calendar dates.
 * All due filters other than "undated" exclude completed tasks.
 * Dates are YYYY-MM-DD civil dates, not timezone-relative timestamps.
 */
const DUE_FILTERS = new Set(['all', 'overdue', 'today', 'next7', 'undated']);
const PRIORITY_FILTERS = new Set(['all', 'low', 'medium', 'high']);

export function localDateKey(instant = new Date()) {
  if (!(instant instanceof Date) || !Number.isFinite(instant.getTime())) {
    throw new TypeError('Expected a valid Date.');
  }
  return [instant.getFullYear(), String(instant.getMonth() + 1).padStart(2, '0'),
    String(instant.getDate()).padStart(2, '0')].join('-');
}

function plusDays(date, offset) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
}

export function filterTasks(tasks, { query = '', priority = 'all', due = 'all', today = localDateKey() } = {}) {
  if (!Array.isArray(tasks)) throw new TypeError('Tasks must be an array.');
  if (typeof query !== 'string' || !PRIORITY_FILTERS.has(priority) || !DUE_FILTERS.has(due)) {
    throw new RangeError('Unsupported board filter.');
  }
  if (typeof today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new RangeError('today must be YYYY-MM-DD.');
  }
  const queryKey = query.trim().toLocaleLowerCase();
  const through = plusDays(today, 6);

  return tasks.filter(task => {
    if (priority !== 'all' && task.priority !== priority) return false;
    if (queryKey) {
      const text = [task.title, task.description, ...(task.tags || [])]
        .join(' ').toLocaleLowerCase();
      if (!text.includes(queryKey)) return false;
    }
    if (due === 'all') return true;
    const date = task.due || '';
    if (due === 'undated') return date === '';
    if (task.status === 'done' || !date) return false;
    if (due === 'overdue') return date < today;
    if (due === 'today') return date === today;
    return date >= today && date <= through;
  });
}
