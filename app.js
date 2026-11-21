import {
  STATUSES, emptyBoard, readStoredBoard, storeBoard, addTask,
  editTask, deleteTask, moveTask, parseBoard, serializeBoard,
} from './src/board.js';
import { filterTasks, localDateKey } from './src/filters.js';

const $ = id => document.getElementById(id);
const dialog = $('task-dialog');
const form = $('task-form');
const search = $('search');
const priorityFilter = $('priority-filter');
const dueFilter = $('due-filter');
const hasActiveFilters = () => Boolean(search.value.trim()) || priorityFilter.value !== 'all' || dueFilter.value !== 'all';
const saved = readStoredBoard();
let board = saved.board;
let dragging = null;
let editingId = null;
const HISTORY_LIMIT = 30;
const undoStack = [];
const redoStack = [];

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
  try {
    storeBoard(board);
    notice(successMessage);
  } catch {
    notice('Could not save locally (storage may be blocked or full). Export a JSON backup now to avoid losing changes.', 'error');
  }
  render();
}
function commit(nextBoard) {
  if (nextBoard === board) return;
  undoStack.push(board);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
  board = nextBoard;
  saveAndRender('Changes saved in this browser.');
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(board);
  board = undoStack.pop();
  saveAndRender('Last board change undone.');
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(board);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  board = redoStack.pop();
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
  const visible = filterTasks(board.tasks, {
    query: search.value,
    priority: priorityFilter.value,
    due: dueFilter.value,
    today: localDateKey(),
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

$('clear-done').addEventListener('click', () => {
  const count = board.tasks.filter(task => task.status === 'done').length;
  if (!count) return;
  if (confirm('Remove ' + count + ' completed task(s)? You can undo this during the current session.')) {
    commit({ ...board, tasks: board.tasks.filter(task => task.status !== 'done') });
  }
});
$('export').addEventListener('click', () => {
  const data = new Blob([serializeBoard(board)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kanban-local-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (file.size > 1024 * 1024) { notice('Choose a JSON file smaller than 1 MB.', 'error'); return; }
  try {
    const imported = parseBoard(await file.text());
    if (!confirm('Replace all ' + board.tasks.length + ' existing tasks with ' + imported.tasks.length + ' imported tasks? Export a backup first if needed.')) return;
    commit(imported);
  } catch (error) { notice('Import failed: ' + error.message, 'error'); }
});

render();
