import { readReminderHistory, writeReminderHistory } from "./storage.js";
import { toDateKey } from "./tasks.js";

export function notificationSupport() {
  return "Notification" in window;
}

export async function requestNotificationPermission() {
  if (!notificationSupport()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

export function checkReminders(tasks, settings, notifyInApp) {
  const overdue = tasks.filter(task => !task.completed && task.dueDate && task.dueDate < toDateKey(new Date()));
  if (overdue.length) notifyInApp(`${overdue.length} ${overdue.length === 1 ? "task is" : "tasks are"} overdue. You can find them in My Tasks.`, "warning", "overdue-daily");
  if (!settings.notificationsEnabled || !notificationSupport() || Notification.permission !== "granted") return;
  const now = Date.now();
  const windowMs = settings.reminderWindow * 60 * 1000;
  const history = readReminderHistory();
  const updated = [...history];
  tasks.filter(task => !task.completed && task.dueDate).forEach(task => {
    const due = new Date(`${task.dueDate}T${task.dueTime || "23:59"}`).getTime();
    const key = `${task.id}:${task.dueDate}:${task.dueTime || ""}`;
    if (due > now && due - now <= windowMs && !history.includes(key)) {
      new Notification("A little deadline heads-up", { body: `${task.title} is due ${task.dueTime ? "at " + task.dueTime : "today"}.` });
      updated.push(key);
    }
  });
  if (updated.length !== history.length) writeReminderHistory(updated);
}
