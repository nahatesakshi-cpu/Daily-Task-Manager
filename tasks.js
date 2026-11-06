export function createTask(data, order) {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    title: data.title.trim(),
    description: data.description.trim(),
    category: data.category,
    priority: data.priority,
    dueDate: data.dueDate,
    dueTime: data.dueTime,
    completed: false,
    createdAt: now,
    completedAt: null,
    order,
    subtasks: data.subtasks.map(subtask => ({ id: makeId(), title: subtask.trim(), completed: false })).filter(subtask => subtask.title)
  };
}

export function updateTask(task, data) {
  const existingSubtasks = [...task.subtasks];
  task.title = data.title.trim();
  task.description = data.description.trim();
  task.category = data.category;
  task.priority = data.priority;
  task.dueDate = data.dueDate;
  task.dueTime = data.dueTime;
  task.subtasks = data.subtasks.map(subtask => {
    const priorIndex = existingSubtasks.findIndex(item => item.title === subtask.trim());
    const prior = priorIndex >= 0 ? existingSubtasks.splice(priorIndex, 1)[0] : null;
    return {
      id: prior?.id || makeId(),
      title: subtask.trim(),
      completed: prior?.completed || false
    };
  }).filter(subtask => subtask.title);
  return task;
}

export function setTaskCompleted(task, completed) {
  task.completed = completed;
  task.completedAt = completed ? new Date().toISOString() : null;
}

export function isOverdue(task, now = new Date()) {
  if (task.completed || !task.dueDate) return false;
  const today = toDateKey(now);
  return task.dueDate < today;
}

export function isDueToday(task, now = new Date()) {
  return Boolean(task.dueDate) && task.dueDate === toDateKey(now);
}

export function isUpcoming(task, now = new Date()) {
  if (task.completed || !task.dueDate || task.dueDate <= toDateKey(now)) return false;
  const due = new Date(`${task.dueDate}T00:00:00`);
  const limit = new Date(now);
  limit.setDate(limit.getDate() + 7);
  return due <= limit;
}

export function formatDate(dateString, options = { month: "short", day: "numeric" }) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return dateString;
  return new Intl.DateTimeFormat(undefined, options).format(new Date(year, month - 1, day));
}

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeId() {
  return window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
