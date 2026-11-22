import { STATUSES, PRIORITIES } from './board.js';
import { localDateKey } from './filters.js';
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
