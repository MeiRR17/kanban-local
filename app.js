import {
  STATUSES, emptyBoard, readStoredBoard, storeBoard, addTask,
  editTask, deleteTask, moveTask, parseBoard, serializeBoard,
} from './src/board.js';
import { filterTasks, localDateKey } from './src/filters.js';
import { boardOverview } from './src/overview.js';
import { boardMetricsJson } from './src/summary.js';
import { boardTasksCsv } from './src/tasks-csv.js';

const $ = id => document.getElementById(id);
const dialog = $('task-dialog');
const form = $('task-form');
const search = $('search');
const priorityFilter = $('priority-filter');
const dueFilter = $('due-filter');
const hasActiveFilters = () => Boolean(search.value.trim()) || priorityFilter.value !== 'all' || dueFilter.value !== 'all';
const saved = readStoredBoard();
let board = saved.board;
let recoveryRequired = saved.recoveryRequired === true;
$('recover-storage').hidden = !recoveryRequired;
let dragging = null;
let editingId = null;
const HISTORY_LIMIT = 30;
const undoStack = [];
const redoStack = [];
let boardRevision = 0;
let importSequence = 0;

const make = (tag, className = '', text = '') => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
};
function notice(message, type = '') {
  $('notice').textContent = message;
  $('notice').className = 'notice' + (type ? ' ' + type : '');
}
if (saved.warning) notice(saved.warning, 'warning');

function saveAndRender(successMessage) {
  if (recoveryRequired) {
    notice('Board changes are in memory only. The unreadable saved data is still protected; export a backup and use Replace saved data to opt in to overwriting it.', 'warning');
  } else {
    try {
      storeBoard(board);
      notice(successMessage);
    } catch {
      notice('Could not save locally (storage may be blocked or full). Export a JSON backup now to avoid losing changes.', 'error');
    }
  }
  render();
}
$('recover-storage').addEventListener('click', () => {
  if (!recoveryRequired) return;
  if (!confirm('The previously saved board is unreadable. Replacing it will permanently overwrite those bytes and cannot be undone. Recover any older backup first. Replace the saved data with the CURRENT board?')) return;
  try {
    storeBoard(board);
    recoveryRequired = false;
    $('recover-storage').hidden = true;
    notice('Current board saved. The unreadable previous storage entry was replaced.', 'warning');
  } catch {
    notice('Storage replacement failed. Existing unreadable data was not intentionally cleared. Export the current board as JSON.', 'error');
  }
});
function commit(nextBoard) {
  if (nextBoard === board) return;
  undoStack.push(board);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
  board = nextBoard;
  boardRevision++;
  saveAndRender('Changes saved in this browser.');
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(board);
  board = undoStack.pop();
  boardRevision++;
  saveAndRender('Last board change undone.');
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(board);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  board = redoStack.pop();
  boardRevision++;
  saveAndRender('Board change reapplied.');
}

function move(id, status, before = null, focusAction = null) {
  try {
    commit(moveTask(board, id, status, before));
    if (focusAction) {
      const target = [...document.querySelectorAll('.task')].find(card => card.dataset.id === id);
      target?.querySelector('[data-action="' + focusAction + '"]')?.focus();
    }
  } catch (error) { notice(error.message, 'error'); }
}

function dueLabel(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  const dayDate = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(dayDate);
}
function overdue(date, status) {
  if (!date || status === 'done') return false;
  const now = new Date();
  const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  return date < today;
}

function card(task) {
  const item = make('article', 'task');
  item.draggable = !hasActiveFilters();
  item.tabIndex = 0;
  item.setAttribute('role', 'listitem');
  item.dataset.id = task.id;
  item.setAttribute('aria-label', task.title + ' — ' + task.status);

  const head = make('div', 'task-head');
  const priority = make('span', 'priority ' + task.priority, task.priority);
  const edit = make('button', 'task-menu', '✎');
  edit.type = 'button';
  edit.dataset.action = 'edit';
  edit.setAttribute('aria-label', 'Edit ' + task.title);
  head.append(priority, edit);
  item.append(head, make('h3', 'task-title', task.title));
  if (task.description) item.append(make('p', 'task-description', task.description));

  if (task.tags.length) {
    const tags = make('div', 'tags');
    for (const label of task.tags) tags.append(make('span', 'tag', label));
    item.append(tags);
  }

  const footer = make('div', 'task-footer');
  if (task.due) footer.append(make('span', 'due' + (overdue(task.due, task.status) ? ' overdue' : ''), (overdue(task.due, task.status) ? 'Overdue · ' : 'Due · ') + dueLabel(task.due)));
  const actions = make('div', 'task-actions');
  const index = STATUSES.findIndex(s => s.id === task.status);
  const siblings = board.tasks.filter(entry => entry.status === task.status);
  const position = siblings.findIndex(entry => entry.id === task.id);
  const hasFilters = hasActiveFilters();
  const buttons = [
    { id: 'up', title: 'Move ' + task.title + ' up within this column', label: '↑', disabled: hasFilters || position <= 0 },
    { id: 'down', title: 'Move ' + task.title + ' down within this column', label: '↓', disabled: hasFilters || position >= siblings.length - 1 },
    { id: 'prev', title: 'Move ' + task.title + ' to previous column', label: '←', disabled: index === 0 },
    { id: 'next', title: 'Move ' + task.title + ' to next column', label: '→', disabled: index === STATUSES.length - 1 },
    { id: 'duplicate', title: 'Duplicate ' + task.title, label: '⧉', disabled: board.tasks.length >= 500 },
    { id: 'delete', title: 'Delete ' + task.title, label: '×', disabled: false },
  ];
  for (const action of buttons) {
    const button = make('button', 'mini-action', action.label);
    button.type = 'button';
    button.dataset.action = action.id;
    button.title = action.title;
    button.setAttribute('aria-label', action.title);
    button.disabled = action.disabled;
    actions.append(button);
  }
  footer.append(actions);
  item.append(footer);
  return item;
}

function render() {
  const today = localDateKey();
  const overview = boardOverview(board.tasks, today);
  $('overview-active').textContent = String(overview.active);
  $('overview-completed').textContent = String(overview.finished);
  $('overview-percent').textContent = overview.completionPercent + '% of board';
  $('overview-overdue-count').textContent = String(overview.overdue);
  $('overview-next7-count').textContent = String(overview.next7);
  $('overview-today').textContent = overview.dueToday + ' due today';
  $('overview-high').textContent = String(overview.highPriority);
  $('overview-overdue').disabled = overview.overdue === 0;
  $('overview-next7').disabled = overview.next7 === 0;
  const visible = filterTasks(board.tasks, {
    query: search.value,
    priority: priorityFilter.value,
    due: dueFilter.value,
    today,
  });
  $('total-count').textContent = board.tasks.length + (visible.length !== board.tasks.length ? ' total · ' + visible.length + ' shown' : ' tasks');
  for (const status of STATUSES) {
    const all = board.tasks.filter(task => task.status === status.id);
    const filtered = visible.filter(task => task.status === status.id);
    $(status.id + '-count').textContent = String(all.length);
    const lane = document.querySelector('[data-list="' + status.id + '"]');
    lane.replaceChildren();
    if (filtered.length) filtered.forEach(task => lane.append(card(task)));
    else lane.append(make('div', 'empty-lane', all.length ? 'No tasks match your filters.' : 'Nothing here yet. Add a task to get started.'));
  }
  $('clear-filters').disabled = !hasActiveFilters();
  $('export-visible-csv').disabled = !hasActiveFilters();
  $('clear-done').disabled = !board.tasks.some(task => task.status === 'done');
  $('undo').disabled = undoStack.length === 0;
  $('redo').disabled = redoStack.length === 0;
}

function openEditor(status = 'todo', id = null) {
  editingId = id;
  const task = id ? board.tasks.find(t => t.id === id) : null;
  if (id && !task) { notice('This task no longer exists.', 'error'); return; }
  $('dialog-heading').textContent = task ? 'Edit task' : 'New task';
  $('form-error').textContent = '';
  $('task-id').value = task?.id || '';
  $('title').value = task?.title || '';
  $('description').value = task?.description || '';
  $('status').value = task?.status || status;
  $('priority').value = task?.priority || 'medium';
  $('due').value = task?.due || '';
  $('tags').value = task?.tags.join(', ') || '';
  dialog.showModal();
  $('title').focus();
}
function closeEditor() { dialog.close(); editingId = null; }

$('add-task').addEventListener('click', () => openEditor());
document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => openEditor(button.dataset.add)));
$('close-dialog').addEventListener('click', closeEditor);
$('cancel-dialog').addEventListener('click', closeEditor);
dialog.addEventListener('click', event => { if (event.target === dialog) closeEditor(); });
dialog.addEventListener('close', () => { editingId = null; });
form.addEventListener('submit', event => {
  event.preventDefault();
  const input = {
    title: $('title').value, description: $('description').value, status: $('status').value,
    priority: $('priority').value, tags: $('tags').value, due: $('due').value,
  };
  try {
    const next = editingId ? editTask(board, editingId, input) : addTask(board, input).board;
    commit(next);
    closeEditor();
  } catch (error) { $('form-error').textContent = error.message; }
});

$('board').addEventListener('click', event => {
  const action = event.target.closest('[data-action]');
  if (!action) return;
  const taskEl = action.closest('[data-id]');
  if (!taskEl) return;
  const id = taskEl.dataset.id;
  const task = board.tasks.find(t => t.id === id);
  if (!task) return;
  if (action.dataset.action === 'edit') openEditor(task.status, id);
  else if (action.dataset.action === 'duplicate') {
    try {
      // Reuse the existing task model to generate a fresh ID and timestamps.
      // Keep the original unchanged; Undo can remove the duplicate.
      const title = task.title.slice(0, 113) + ' (copy)';
      commit(addTask(board, { ...task, title }).board);
      notice('Task duplicated locally. Undo removes the new copy.');
    } catch (error) { notice(error.message, 'error'); }
  }
  else if (action.dataset.action === 'delete') {
    if (confirm('Delete "' + task.title + '"? You can undo this change during this session.')) commit(deleteTask(board, id));
  } else if (action.dataset.action === 'up' || action.dataset.action === 'down') {
    const siblings = board.tasks.filter(entry => entry.status === task.status);
    const position = siblings.findIndex(entry => entry.id === id);
    const direction = action.dataset.action;
    if (direction === 'up' && position > 0) move(id, task.status, siblings[position - 1].id, direction);
    else if (direction === 'down' && position >= 0 && position < siblings.length - 1) {
      // Insert ahead of the item two positions later; append if at the end.
      move(id, task.status, siblings[position + 2]?.id ?? null, direction);
    }
  } else {
    const index = STATUSES.findIndex(s => s.id === task.status);
    const next = STATUSES[index + (action.dataset.action === 'prev' ? -1 : 1)];
    if (next) move(id, next.id, null, action.dataset.action);
  }
});

$('board').addEventListener('dragstart', event => {
  const target = event.target.closest('.task');
  if (!target) return;
  dragging = target.dataset.id;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', dragging);
  target.classList.add('dragging');
});
$('board').addEventListener('dragend', () => {
  dragging = null;
  document.querySelectorAll('.drag-over,.drag-before,.dragging').forEach(el => el.classList.remove('drag-over', 'drag-before', 'dragging'));
});
$('board').addEventListener('dragover', event => {
  if (!dragging || hasActiveFilters()) return;
  event.preventDefault();
  document.querySelectorAll('.drag-before,.drag-over').forEach(el => el.classList.remove('drag-before', 'drag-over'));
  const target = event.target.closest('.task');
  if (target && target.dataset.id !== dragging) target.classList.add('drag-before');
  else event.target.closest('.lane')?.classList.add('drag-over');
});
$('board').addEventListener('drop', event => {
  if (!dragging || hasActiveFilters()) return;
  event.preventDefault();
  const lane = event.target.closest('.lane');
  const target = event.target.closest('.task');
  if (lane) {
    const before = target?.dataset.id !== dragging ? target?.dataset.id : null;
    move(dragging, lane.dataset.status, before);
  }
  dragging = null;
  document.querySelectorAll('.drag-over,.drag-before,.dragging').forEach(el => el.classList.remove('drag-over', 'drag-before', 'dragging'));
});

$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
document.addEventListener('keydown', event => {
  if (dialog.open || !event.ctrlKey && !event.metaKey || event.altKey) return;
  if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  const key = event.key.toLowerCase();
  if (key === 'z') {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
  } else if (key === 'y' && !event.shiftKey) {
    event.preventDefault();
    redo();
  }
});
search.addEventListener('input', render);
priorityFilter.addEventListener('change', render);
dueFilter.addEventListener('change', render);
$('clear-filters').addEventListener('click', () => {
  search.value = '';
  priorityFilter.value = 'all';
  dueFilter.value = 'all';
  render();
  notice('All board filters cleared. Dragging and reordering are available again.');
  search.focus();
});
$('overview-overdue').addEventListener('click', () => {
  dueFilter.value = 'overdue';
  render();
  dueFilter.focus();
});
$('overview-next7').addEventListener('click', () => {
  dueFilter.value = 'next7';
  render();
  dueFilter.focus();
});

$('clear-done').addEventListener('click', () => {
  const count = board.tasks.filter(task => task.status === 'done').length;
  if (!count) return;
  if (confirm('Remove ' + count + ' completed task(s)? You can undo this during the current session.')) {
    commit({ ...board, tasks: board.tasks.filter(task => task.status !== 'done') });
  }
});
/** Decode imported backups strictly: File.text() silently substitutes invalid
 * UTF-8, which could corrupt task descriptions before overwrite confirmation.
 */
async function readBoardBackup(file) {
  if (file.size > 1024 * 1024) throw new RangeError('Choose a JSON file smaller than 1 MB.');
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > 1024 * 1024) throw new RangeError('Choose a JSON file smaller than 1 MB.');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Board backup must be valid UTF-8; no tasks were imported.');
  }
}
function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadJson(filename, content) {
  downloadFile(filename, content, 'application/json;charset=utf-8');
}
$('export-visible-csv').addEventListener('click', () => {
  if (!hasActiveFilters()) {
    notice('Set a search, priority, or due-date filter before exporting visible tasks.', 'warning');
    return;
  }
  try {
    // Re-run the same pure filter as render() with one captured local date.
    // Never serialize hidden tasks, even if the full board changed in memory.
    const today = localDateKey();
    const visible = filterTasks(board.tasks, {
      query: search.value,
      priority: priorityFilter.value,
      due: dueFilter.value,
      today,
    });
    downloadFile('kanban-visible-tasks-' + today + '.csv',
      boardTasksCsv({ version: 1, tasks: visible }), 'text/csv;charset=utf-8');
    notice('Exported ' + visible.length + ' currently visible task(s) as CSV. ' +
      'Hidden tasks were excluded. CSV contains task details and cannot restore the board.');
  } catch (error) {
    notice('Filtered task CSV export failed: ' + error.message, 'error');
  }
});
$('export-csv').addEventListener('click', () => {
  try {
    downloadFile('kanban-tasks-' + localDateKey() + '.csv', boardTasksCsv(board),
      'text/csv;charset=utf-8');
    notice('All task details exported as CSV, regardless of filters. The file may be confidential; CSV cannot restore the board.');
  } catch (error) {
    notice('Task CSV export failed: ' + error.message, 'error');
  }
});

$('export').addEventListener('click', () => {
  downloadJson('kanban-local-' + localDateKey() + '.json', serializeBoard(board));
});
$('export-summary').addEventListener('click', () => {
  try {
    downloadJson('kanban-metrics-' + localDateKey() + '.json', boardMetricsJson(board));
    notice('Counts-only board metrics exported. No task details are included, but aggregate numbers may still be sensitive.');
  } catch (error) {
    notice('Metrics export failed: ' + error.message, 'error');
  }
});
$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const request = ++importSequence;
  const startingRevision = boardRevision;
  if (file.size > 1024 * 1024) {
    notice('Choose a JSON file smaller than 1 MB.', 'error');
    return;
  }
  try {
    const text = await readBoardBackup(file);
    if (request !== importSequence) return;
    if (boardRevision !== startingRevision || dialog.open) {
      notice('Board changed or task editor opened during file reading. Import cancelled to preserve your changes.', 'warning');
      return;
    }
    const imported = parseBoard(text);
    if (!confirm('Replace all ' + board.tasks.length + ' existing tasks with ' + imported.tasks.length + ' imported tasks? Export a backup first if needed.')) return;
    if (request !== importSequence || boardRevision !== startingRevision || dialog.open) return;
    commit(imported);
  } catch (error) {
    if (request === importSequence) notice('Import failed: ' + error.message, 'error');
  }
});

render();
