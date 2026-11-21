import { filterTasks, localDateKey } from './filters.js';

/**
 * Counts-only local board overview, independent of current UI filters.
 * Completed work is counted separately; overdue and near-term counts include
 * active (todo/doing) tasks only. No task titles or descriptions are copied.
 */
export function boardOverview(tasks, today = localDateKey()) {
  if (!Array.isArray(tasks) || tasks.length > 500) {
    throw new RangeError('Expected at most 500 board tasks.');
  }
  const finished = tasks.filter(task => task.status === 'done').length;
  const active = tasks.filter(task => task.status !== 'done').length;
  const highPriority = tasks.filter(task => task.status !== 'done' && task.priority === 'high').length;
  const overdue = filterTasks(tasks, { due: 'overdue', today }).length;
  const dueToday = filterTasks(tasks, { due: 'today', today }).length;
  const next7 = filterTasks(tasks, { due: 'next7', today }).length;
  return {
    total: tasks.length,
    active,
    finished,
    highPriority,
    overdue,
    dueToday,
    next7,
    completionPercent: tasks.length ? Math.round(finished / tasks.length * 100) : 0,
    asOf: today,
  };
}
