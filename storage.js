const KEYS = {
  tasks: "daylight.tasks.v1",
  categories: "daylight.categories.v1",
  theme: "daylight.theme.v1",
  settings: "daylight.settings.v1",
  reminders: "daylight.reminders.v1"
};

export const DEFAULT_CATEGORIES = ["Personal", "Study", "Work", "Shopping", "Health", "Other"];

function readJSON(key, fallback, validate = () => true) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    return validate(value) ? value : fallback;
  } catch (error) {
    console.warn(`Could not read saved data for "${key}".`, error);
    return fallback;
  }
}

export function readTasks() {
  let saved = readJSON(KEYS.tasks, null, Array.isArray);
  if (saved === null) {
    const legacy = readJSON("tasks", [], Array.isArray);
    saved = legacy.map((item, index) => ({
      id: String(item.id ?? `legacy-${Date.now()}-${index}`),
      title: String(item.title ?? item.text ?? "Untitled task"),
      description: "",
      category: "Personal",
      priority: "medium",
      dueDate: "",
      dueTime: "",
      completed: Boolean(item.completed),
      createdAt: new Date().toISOString(),
      completedAt: item.completed ? new Date().toISOString() : null,
      order: index,
      subtasks: []
    }));
    if (legacy.length) writeTasks(saved);
  }
  return saved.filter(task => task && typeof task === "object" && task.id != null).map((task, index) => ({
    id: String(task.id),
    title: String(task.title ?? task.text ?? "Untitled task"),
    description: String(task.description ?? ""),
    category: String(task.category ?? "Personal"),
    priority: ["high", "medium", "low"].includes(task.priority) ? task.priority : "medium",
    dueDate: isDateKey(task.dueDate) ? task.dueDate : "",
    dueTime: isTime(task.dueTime) ? task.dueTime : "",
    completed: Boolean(task.completed),
    createdAt: safeTimestamp(task.createdAt),
    completedAt: task.completed && isTimestamp(task.completedAt) ? new Date(task.completedAt).toISOString() : null,
    order: Number.isFinite(task.order) ? task.order : index,
    subtasks: Array.isArray(task.subtasks) ? task.subtasks.filter(subtask => subtask && typeof subtask.title === "string").map(subtask => ({
      id: String(subtask.id ?? `sub-${index}-${Math.random().toString(36).slice(2, 8)}`),
      title: subtask.title.slice(0, 120),
      completed: Boolean(subtask.completed)
    })) : []
  }));
}

export function writeTasks(tasks) {
  writeJSON(KEYS.tasks, tasks);
}

export function readCategories() {
  const saved = readJSON(KEYS.categories, [], Array.isArray);
  return [...new Set([...DEFAULT_CATEGORIES, ...saved.filter(item => typeof item === "string" && item.trim()).map(item => item.trim())])];
}

export function writeCategories(categories) {
  writeJSON(KEYS.categories, categories.filter(category => !DEFAULT_CATEGORIES.includes(category)));
}

export function readTheme() {
  const theme = readJSON(KEYS.theme, "light", value => value === "light" || value === "dark");
  return theme;
}

export function writeTheme(theme) {
  writeJSON(KEYS.theme, theme);
}

export function readSettings() {
  const settings = readJSON(KEYS.settings, {}, value => value && typeof value === "object" && !Array.isArray(value));
  return {
    notificationsEnabled: Boolean(settings.notificationsEnabled),
    reminderWindow: [15, 60, 1440].includes(Number(settings.reminderWindow)) ? Number(settings.reminderWindow) : 60
  };
}

export function writeSettings(settings) {
  writeJSON(KEYS.settings, settings);
}

export function readReminderHistory() {
  return readJSON(KEYS.reminders, [], Array.isArray).filter(item => typeof item === "string");
}

export function writeReminderHistory(history) {
  writeJSON(KEYS.reminders, history.slice(-200));
}

function writeJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Could not save "${key}" to local storage.`, error);
    window.dispatchEvent(new CustomEvent("daylight-storage-error"));
  }
}

function isDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function safeTimestamp(value) {
  return isTimestamp(value) ? new Date(value).toISOString() : new Date().toISOString();
}
