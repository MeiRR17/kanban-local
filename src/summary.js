import { STATUSES, PRIORITIES } from './board.js';
import { filterTasks, localDateKey } from './filters.js';
import { boardOverview } from './overview.js';

/**
 * A narrowly scoped, counts-only export for sharing board progress.
 * No task titles, descriptions, identifiers, tags, timestamps or due dates
 * are ever copied into the returned object.
 */
export function boardMetrics(board, today = localDateKey()) {
  if (!board || board.version !== 1 || !Array.isArray(board.tasks) ||
      board.tasks.length > 500) {
    throw new TypeError('Expected a version-1 Kanban Local board (max 500 tasks).');
  }
  const statuses = new Set(STATUSES.map(item => item.id));
  const priorities = new Set(PRIORITIES);
  if (board.tasks.some(task => !task || !statuses.has(task.status) ||
      !priorities.has(task.priority))) {
    throw new TypeError('The board contains an invalid task.');
  }
  const overview = boardOverview(board.tasks, today);
  return {
    format: 'kanban-local-counts-v1',
    asOf: overview.asOf,
    total: overview.total,
    active: overview.active,
    finished: overview.finished,
    completionPercent: overview.completionPercent,
    overdue: overview.overdue,
    dueToday: overview.dueToday,
    dueNextSevenDays: overview.next7,
    activeHighPriority: overview.highPriority,
    byStatus: Object.fromEntries(STATUSES.map(status => [
      status.id, board.tasks.filter(task => task.status === status.id).length,
    ])),
    byPriority: Object.fromEntries(PRIORITIES.map(priority => [
      priority, board.tasks.filter(task => task.priority === priority).length,
    ])),
    advisory: 'Counts and the local reporting date can still be sensitive. This is not a backup.',
  };
}

export function boardMetricsJson(board, today = localDateKey()) {
  return JSON.stringify(boardMetrics(board, today), null, 2) + '\n';
}

/**
 * Counts-only metrics for the tasks currently matching an active board filter.
 * The search expression and selected filter values are intentionally excluded
 * from the output; only which kinds of filter are active are disclosed.
 * This export is not a restorable backup or an anonymization guarantee.
 */
export function filteredBoardMetricsJson(board, filters, today = localDateKey()) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw new TypeError('Expected board filter options.');
  }
  const { query = '', priority = 'all', due = 'all' } = filters;
  // Validate the whole board before computing a potentially incomplete subset.
  const full = boardMetrics(board, today);
  if (typeof query !== 'string') {
    throw new TypeError('Search must be text.');
  }
  if (!query.trim() && priority === 'all' && due === 'all') {
    throw new RangeError('Activate at least one filter before exporting visible metrics.');
  }
  const visible = filterTasks(board.tasks, { query, priority, due, today });
  const metrics = boardMetrics({ version: 1, tasks: visible }, today);
  return JSON.stringify({
    ...metrics,
    format: 'kanban-local-visible-counts-v1',
    scope: 'matching-tasks-only',
    sourceTaskCount: full.total,
    activeFilterKinds: {
      search: Boolean(query.trim()),
      priority: priority !== 'all',
      due: due !== 'all',
    },
    advisory: 'Counts, total board size, filter kinds and the local reporting date can still be sensitive. No filter values or task details are included. This is not a backup.',
  }, null, 2) + '\n';
}
