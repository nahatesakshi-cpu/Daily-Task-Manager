import { readTasks, writeTasks, readCategories, writeCategories, readTheme, writeTheme, readSettings, writeSettings } from "./storage.js";
import { createTask, updateTask, setTaskCompleted, isOverdue, isDueToday, isUpcoming, formatDate, toDateKey } from "./tasks.js";
import { renderDashboard, renderViewCharts } from "./dashboard.js";
import { notificationSupport, requestNotificationPermission, checkReminders } from "./notifications.js";

let tasks = readTasks();
let categories = readCategories();
let settings = readSettings();
let currentView = "dashboard";
let currentFilter = "all";
let selectedCategory = "";
let draggedTaskId = "";
let detailTaskId = "";
const notifiedInApp = new Set();
const taskDialog = document.getElementById("taskDialog");
const categoryDialog = document.getElementById("categoryDialog");
const detailDialog = document.getElementById("detailDialog");

document.documentElement.dataset.theme = readTheme();
document.getElementById("todayLabel").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date()).toUpperCase();
document.getElementById("reminderWindow").value = String(settings.reminderWindow);

function persistTasks() {
  writeTasks(tasks);
  renderAll();
}

function renderAll() {
  renderDashboard(tasks, categories, document.getElementById("chartPeriod").value);
  renderCategoryNavigation();
  renderTaskList();
  renderCategoryManager();
  renderCategorySelect();
  renderViewCharts(tasks, categories);
  updateSettingsUI();
}

function renderCategoryNavigation() {
  const root = document.getElementById("categoryNav");
  root.replaceChildren();
  categories.forEach((category, index) => {
    const button = document.createElement("button");
    button.className = `category-nav-link${selectedCategory === category ? " selected" : ""}`;
    button.dataset.category = category;
    const dot = document.createElement("span");
    dot.className = `category-dot dot-${index % 6}`;
    const name = document.createElement("span");
    name.textContent = category;
    const count = document.createElement("small");
    count.textContent = tasks.filter(task => task.category === category && !task.completed).length;
    button.append(dot, name, count);
    root.appendChild(button);
  });
}

function renderCategoryManager() {
  const root = document.getElementById("categoryCards");
  root.replaceChildren();
  categories.forEach((category, index) => {
    const isDefault = ["Personal", "Study", "Work", "Shopping", "Health", "Other"].includes(category);
    const card = document.createElement("article");
    card.className = "category-card panel";
    const top = document.createElement("div");
    top.className = "category-card-top";
    const icon = document.createElement("span");
    icon.className = `category-large-icon dot-${index % 6}`;
    icon.textContent = ["◌", "▤", "◈", "⌑", "✿", "◇"][index % 6];
    const actions = document.createElement("div");
    actions.className = "category-actions";
    if (!isDefault) {
      const edit = document.createElement("button");
      edit.className = "icon-button tiny";
      edit.dataset.editCategory = category;
      edit.setAttribute("aria-label", `Rename ${category}`);
      edit.textContent = "✎";
      const remove = document.createElement("button");
      remove.className = "icon-button tiny category-delete";
      remove.dataset.deleteCategory = category;
      remove.setAttribute("aria-label", `Delete ${category}`);
      remove.textContent = "×";
      actions.append(edit, remove);
    } else {
      const badge = document.createElement("span");
      badge.className = "default-badge";
      badge.textContent = "Default";
      actions.appendChild(badge);
    }
    top.append(icon, actions);
    const title = document.createElement("h3");
    title.textContent = category;
    const count = document.createElement("p");
    const amount = tasks.filter(task => task.category === category).length;
    count.textContent = `${amount} ${amount === 1 ? "task" : "tasks"}`;
    card.append(top, title, count);
    root.appendChild(card);
  });
}

function renderCategorySelect() {
  const select = document.getElementById("taskCategory");
  const selected = select.value;
  select.replaceChildren();
  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
  select.value = categories.includes(selected) ? selected : categories[0];
}

function renderCategoryChips() {
  const root = document.getElementById("categoryChips");
  root.replaceChildren();
  if (currentView !== "all" && currentView !== "today" && currentView !== "upcoming" && currentView !== "completed") return;
  const all = document.createElement("button");
  all.className = `category-chip${selectedCategory ? "" : " active"}`;
  all.textContent = "Every category";
  all.dataset.category = "";
  root.appendChild(all);
  categories.forEach((category, index) => {
    const chip = document.createElement("button");
    chip.className = `category-chip${selectedCategory === category ? " active" : ""}`;
    chip.dataset.category = category;
    const dot = document.createElement("span");
    dot.className = `category-dot dot-${index % 6}`;
    chip.append(dot, document.createTextNode(category));
    root.appendChild(chip);
  });
}

function getVisibleTasks() {
  const search = document.getElementById("searchInput").value.trim().toLocaleLowerCase();
  let visible = tasks.filter(task => {
    if (currentFilter === "active" && task.completed) return false;
    if (currentFilter === "completed" && !task.completed) return false;
    if (currentFilter === "today" && !isDueToday(task)) return false;
    if (currentFilter === "upcoming" && !isUpcoming(task)) return false;
    if (currentFilter === "overdue" && !isOverdue(task)) return false;
    if (currentFilter === "high" && (task.completed || task.priority !== "high")) return false;
    if (selectedCategory && task.category !== selectedCategory) return false;
    if (search && !`${task.title} ${task.description} ${task.category}`.toLocaleLowerCase().includes(search)) return false;
    return true;
  });
  const sort = document.getElementById("sortSelect").value;
  if (sort === "priority") {
    const rank = { high: 0, medium: 1, low: 2 };
    visible.sort((a, b) => rank[a.priority] - rank[b.priority] || a.order - b.order);
  } else if (sort === "due") {
    visible.sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || (a.dueTime || "").localeCompare(b.dueTime || ""));
  } else if (sort === "created") {
    visible.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sort === "title") {
    visible.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    visible.sort((a, b) => a.order - b.order);
  }
  return visible;
}

function renderTaskList() {
  renderCategoryChips();
  const root = document.getElementById("taskList");
  root.replaceChildren();
  const visible = getVisibleTasks();
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const art = document.createElement("div");
    art.className = "empty-illustration";
    art.textContent = document.getElementById("searchInput").value ? "⌕" : currentFilter === "completed" ? "✦" : "☼";
    const heading = document.createElement("h3");
    heading.textContent = document.getElementById("searchInput").value ? "No matches just yet" : currentFilter === "completed" ? "Nothing crossed off yet" : "A little space to start";
    const copy = document.createElement("p");
    copy.textContent = document.getElementById("searchInput").value ? "Try another search or clear a filter." : "Create a task to give your day a gentle sense of direction.";
    empty.append(art, heading, copy);
    if (!document.getElementById("searchInput").value && currentFilter !== "completed") {
      const create = document.createElement("button");
      create.className = "primary-button";
      create.dataset.openTask = "";
      create.textContent = "＋ Add your first task";
      empty.appendChild(create);
    }
    root.appendChild(empty);
    return;
  }
  visible.forEach(task => root.appendChild(createTaskElement(task)));
}

function createTaskElement(task) {
  const article = document.createElement("article");
  article.className = `task-card${task.completed ? " is-completed" : ""}${isOverdue(task) ? " is-overdue" : ""}`;
  article.dataset.taskId = task.id;
  article.draggable = document.getElementById("sortSelect").value === "manual";
  const drag = document.createElement("span");
  drag.className = "drag-handle";
  drag.textContent = "⠿";
  drag.setAttribute("aria-label", "Drag to reorder task");
  drag.title = "Drag to reorder";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked = task.completed;
  checkbox.dataset.toggleTask = task.id;
  checkbox.setAttribute("aria-label", `${task.completed ? "Reactivate" : "Complete"} ${task.title}`);
  const content = document.createElement("div");
  content.className = "task-main";
  const title = document.createElement("button");
  title.className = "task-title-button";
  title.dataset.taskDetails = task.id;
  title.textContent = task.title;
  const description = document.createElement("p");
  description.className = "task-description";
  description.textContent = task.description || "No description added.";
  const subtaskInfo = document.createElement("span");
  subtaskInfo.className = "subtask-progress";
  if (task.subtasks.length) {
    const done = task.subtasks.filter(subtask => subtask.completed).length;
    subtaskInfo.textContent = `☷ ${done}/${task.subtasks.length} subtasks · ${Math.round((done / task.subtasks.length) * 100)}%`;
  }
  content.append(title, description);
  if (task.subtasks.length) content.appendChild(subtaskInfo);
  const meta = document.createElement("div");
  meta.className = "task-meta";
  const category = document.createElement("span");
  category.className = "task-category-tag";
  category.textContent = task.category;
  const priority = document.createElement("span");
  priority.className = `priority-tag priority-${task.priority}`;
  priority.textContent = `${task.priority} priority`;
  const date = document.createElement("span");
  date.className = `task-due${isOverdue(task) ? " due-overdue" : isDueToday(task) ? " due-today" : ""}`;
  if (task.dueDate) date.textContent = `${isOverdue(task) ? "Overdue · " : isDueToday(task) ? "Today · " : ""}${formatDate(task.dueDate)}${task.dueTime ? `, ${task.dueTime}` : ""}`;
  else date.textContent = "No due date";
  const created = document.createElement("span");
  created.className = "created-date";
  created.textContent = `Added ${formatDate(toDateKey(new Date(task.createdAt)))}`;
  meta.append(category, priority, date, created);
  const actions = document.createElement("div");
  actions.className = "task-actions";
  const edit = document.createElement("button");
  edit.className = "icon-button tiny";
  edit.dataset.editTask = task.id;
  edit.setAttribute("aria-label", `Edit ${task.title}`);
  edit.title = "Edit task";
  edit.textContent = "✎";
  const remove = document.createElement("button");
  remove.className = "icon-button tiny delete-task";
  remove.dataset.deleteTask = task.id;
  remove.setAttribute("aria-label", `Delete ${task.title}`);
  remove.title = "Delete task";
  remove.textContent = "×";
  actions.append(edit, remove);
  article.append(drag, checkbox, content, meta, actions);
  return article;
}

function setView(view, preserveCategory = false) {
  const valid = ["dashboard", "all", "today", "upcoming", "completed", "categories", "statistics", "settings"];
  if (!valid.includes(view)) return;
  currentView = view;
  if (!preserveCategory) selectedCategory = "";
  const isTaskView = ["all", "today", "upcoming", "completed"].includes(view);
  document.querySelectorAll(".view-panel").forEach(panel => panel.classList.remove("active"));
  const targetId = view === "dashboard" ? "dashboardView" : isTaskView ? "tasksView" : `${view}View`;
  document.getElementById(targetId).classList.add("active");
  document.querySelectorAll(".nav-link[data-view]").forEach(link => link.classList.toggle("active", link.dataset.view === view || (isTaskView && link.dataset.view === "all" && view === "all")));
  const titles = { dashboard: "Dashboard", all: "My Tasks", today: "Today's Tasks", upcoming: "Upcoming", completed: "Completed", categories: "Categories", statistics: "Statistics", settings: "Settings" };
  document.getElementById("breadcrumbCurrent").textContent = selectedCategory || titles[view];
  if (isTaskView) {
    currentFilter = view === "all" ? "all" : view;
    const titlesByView = { all: ["YOUR WORKSPACE", "My tasks", "A little structure makes room for a lot of creativity."], today: ["MAKE TODAY COUNT", "Today's tasks", "A focused list for the day in front of you."], upcoming: ["ON THE HORIZON", "Upcoming tasks", "The next seven days, thoughtfully mapped out."], completed: ["LOOK AT YOU GO", "Completed tasks", "Everything you've already made happen."] };
    document.getElementById("tasksEyebrow").textContent = titlesByView[view][0];
    document.getElementById("tasksTitle").textContent = selectedCategory ? `${selectedCategory} tasks` : titlesByView[view][1];
    document.getElementById("tasksSubtitle").textContent = titlesByView[view][2];
    updateFilterTabs();
    renderTaskList();
  }
  if (view === "categories") renderCategoryManager();
  if (view === "statistics") renderViewCharts(tasks, categories);
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("mobileScrim").classList.remove("visible");
  document.getElementById("menuToggle").setAttribute("aria-expanded", "false");
}

function updateFilterTabs() {
  document.querySelectorAll(".filter-tab").forEach(button => button.classList.toggle("active", button.dataset.filter === currentFilter));
}

function openTaskForm(task = null) {
  document.getElementById("taskForm").reset();
  document.getElementById("taskFormError").textContent = "";
  document.getElementById("subtaskFields").replaceChildren();
  document.getElementById("taskId").value = task?.id || "";
  document.getElementById("taskDialogTitle").textContent = task ? "Edit task" : "Create a task";
  document.getElementById("saveTaskButton").textContent = task ? "Save changes" : "Save task";
  renderCategorySelect();
  if (task) {
    document.getElementById("taskTitle").value = task.title;
    document.getElementById("taskDescription").value = task.description;
    document.getElementById("taskCategory").value = task.category;
    document.getElementById("taskPriority").value = task.priority;
    document.getElementById("taskDueDate").value = task.dueDate;
    document.getElementById("taskDueTime").value = task.dueTime;
    task.subtasks.forEach(subtask => addSubtaskField(subtask.title));
  }
  taskDialog.showModal();
  document.getElementById("taskTitle").focus();
}

function addSubtaskField(value = "") {
  const row = document.createElement("div");
  row.className = "subtask-input-row";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "form-control subtask-input";
  input.maxLength = 120;
  input.placeholder = "A small step...";
  input.value = value;
  input.setAttribute("aria-label", "Subtask title");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "icon-button tiny remove-subtask-field";
  remove.textContent = "×";
  remove.setAttribute("aria-label", "Remove subtask");
  row.append(input, remove);
  document.getElementById("subtaskFields").appendChild(row);
  input.focus();
}

function saveTask(event) {
  event.preventDefault();
  const title = document.getElementById("taskTitle").value.trim();
  const error = document.getElementById("taskFormError");
  if (!title) {
    error.textContent = "A task title is required.";
    document.getElementById("taskTitle").focus();
    return;
  }
  const data = {
    title,
    description: document.getElementById("taskDescription").value,
    category: document.getElementById("taskCategory").value,
    priority: document.getElementById("taskPriority").value,
    dueDate: document.getElementById("taskDueDate").value,
    dueTime: document.getElementById("taskDueTime").value,
    subtasks: [...document.querySelectorAll(".subtask-input")].map(input => input.value).filter(value => value.trim())
  };
  const id = document.getElementById("taskId").value;
  if (id) {
    const task = tasks.find(item => item.id === id);
    if (task) updateTask(task, data);
  } else {
    tasks.push(createTask(data, Math.max(-1, ...tasks.map(task => task.order)) + 1));
  }
  taskDialog.close();
  persistTasks();
  toast(id ? "Your task has been updated." : "A new task is on your list.", "success");
}

function showTaskDetails(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;
  detailTaskId = id;
  const root = document.getElementById("taskDetails");
  root.replaceChildren();
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = task.category.toUpperCase();
  const title = document.createElement("h2");
  title.id = "detailTitle";
  title.textContent = task.title;
  const description = document.createElement("p");
  description.className = "detail-description";
  description.textContent = task.description || "No description added.";
  const meta = document.createElement("div");
  meta.className = "detail-meta";
  [["Priority", `${task.priority[0].toUpperCase()}${task.priority.slice(1)}`], ["Created", new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(task.createdAt))], ["Due", task.dueDate ? `${formatDate(task.dueDate, { month: "long", day: "numeric", year: "numeric" })}${task.dueTime ? ` at ${task.dueTime}` : ""}` : "No due date"], ["Status", task.completed ? "Completed" : isOverdue(task) ? "Overdue" : "Active"]].forEach(([label, value]) => {
    const item = document.createElement("div");
    item.className = "detail-meta-item";
    const key = document.createElement("small");
    key.textContent = label;
    const val = document.createElement("span");
    val.textContent = value;
    item.append(key, val);
    meta.appendChild(item);
  });
  root.append(eyebrow, title, description, meta);
  if (task.completedAt) {
    const completedAt = document.createElement("p");
    completedAt.className = "completion-timestamp";
    completedAt.textContent = `Completed ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(task.completedAt))}`;
    root.appendChild(completedAt);
  }
  if (task.subtasks.length) {
    const heading = document.createElement("h3");
    heading.className = "detail-subtasks-heading";
    const completedSubtasks = task.subtasks.filter(item => item.completed).length;
    heading.textContent = `Subtasks · ${completedSubtasks}/${task.subtasks.length} · ${Math.round((completedSubtasks / task.subtasks.length) * 100)}%`;
    const list = document.createElement("div");
    list.className = "detail-subtasks";
    task.subtasks.forEach(subtask => {
      const row = document.createElement("label");
      row.className = "detail-subtask";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = subtask.completed;
      checkbox.dataset.toggleSubtask = subtask.id;
      const text = document.createElement("span");
      text.textContent = subtask.title;
      row.append(checkbox, text);
      list.appendChild(row);
    });
    root.append(heading, list);
  }
  detailDialog.showModal();
}

function openCategoryForm(category = "") {
  document.getElementById("categoryForm").reset();
  document.getElementById("categoryFormError").textContent = "";
  document.getElementById("categoryOldName").value = category;
  document.getElementById("categoryDialogTitle").textContent = category ? "Rename category" : "New category";
  document.getElementById("categoryName").value = category;
  categoryDialog.showModal();
  document.getElementById("categoryName").focus();
}

function saveCategory(event) {
  event.preventDefault();
  const name = document.getElementById("categoryName").value.trim();
  const oldName = document.getElementById("categoryOldName").value;
  const error = document.getElementById("categoryFormError");
  if (!name) {
    error.textContent = "Please enter a category name.";
    return;
  }
  if (categories.some(category => category.toLocaleLowerCase() === name.toLocaleLowerCase() && category !== oldName)) {
    error.textContent = "That category already exists.";
    return;
  }
  if (oldName) {
    if (["Personal", "Study", "Work", "Shopping", "Health", "Other"].includes(oldName)) {
      error.textContent = "Default categories cannot be renamed. You can rename custom categories.";
      return;
    }
    categories = categories.map(category => category === oldName ? name : category);
    tasks.forEach(task => { if (task.category === oldName) task.category = name; });
    writeTasks(tasks);
  } else {
    categories.push(name);
  }
  writeCategories(categories);
  categoryDialog.close();
  renderAll();
  toast(oldName ? "Category renamed." : "Category added.", "success");
}

function deleteCategory(name) {
  if (["Personal", "Study", "Work", "Shopping", "Health", "Other"].includes(name)) {
    toast("Default categories cannot be deleted.", "warning");
    return;
  }
  const count = tasks.filter(task => task.category === name).length;
  const explanation = count ? ` ${count} ${count === 1 ? "task will" : "tasks will"} be moved to Other.` : "";
  if (!window.confirm(`Delete "${name}"?${explanation}`)) return;
  tasks.forEach(task => { if (task.category === name) task.category = "Other"; });
  categories = categories.filter(category => category !== name);
  writeCategories(categories);
  writeTasks(tasks);
  if (selectedCategory === name) selectedCategory = "";
  renderAll();
  toast("Category deleted. Your tasks are safe in Other.", "success");
}

function deleteTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task || !window.confirm(`Delete "${task.title}"? This can't be undone.`)) return;
  tasks = tasks.filter(item => item.id !== id);
  tasks.forEach((item, index) => { item.order = index; });
  persistTasks();
  toast("Task deleted.", "success");
}

function clearCompleted() {
  const count = tasks.filter(task => task.completed).length;
  if (!count) {
    toast("There are no completed tasks to clear.", "info");
    return;
  }
  if (!window.confirm(`Clear ${count} completed ${count === 1 ? "task" : "tasks"}? This can't be undone.`)) return;
  tasks = tasks.filter(task => !task.completed);
  tasks.forEach((task, index) => { task.order = index; });
  persistTasks();
  toast(`${count} completed ${count === 1 ? "task" : "tasks"} cleared.`, "success");
}

function toast(message, type = "info", key = "") {
  if (key) {
    const todayKey = `${key}:${toDateKey(new Date())}`;
    if (notifiedInApp.has(todayKey)) return;
    notifiedInApp.add(todayKey);
  }
  const region = document.getElementById("toastRegion");
  const item = document.createElement("div");
  item.className = `toast toast-${type}`;
  item.textContent = message;
  region.appendChild(item);
  window.setTimeout(() => {
    item.classList.add("toast-leaving");
    window.setTimeout(() => item.remove(), 220);
  }, 4200);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  writeTheme(theme);
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  document.getElementById("themeToggle").setAttribute("aria-label", label);
  document.getElementById("settingsThemeButton").textContent = label;
  document.getElementById("themeToggle").textContent = theme === "dark" ? "☀" : "☾";
  renderAll();
}

function updateSettingsUI() {
  const status = !notificationSupport() ? "This browser does not support desktop notifications." : Notification.permission === "denied" ? "Permission was denied. Change it in your browser's site settings." : settings.notificationsEnabled && Notification.permission === "granted" ? "Reminders are enabled for this browser." : "Notifications are currently off.";
  document.getElementById("permissionStatus").textContent = status;
  document.getElementById("enableNotifications").textContent = settings.notificationsEnabled ? "Disable reminders" : "Enable reminders";
  document.getElementById("enableNotifications").disabled = !settings.notificationsEnabled && (!notificationSupport() || Notification.permission === "denied");
  document.getElementById("notificationDot").classList.toggle("enabled", settings.notificationsEnabled);
}

function exportData() {
  const content = JSON.stringify({ tasks, categories, theme: document.documentElement.dataset.theme, settings }, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "daylight-productivity-data.json";
  anchor.click();
  URL.revokeObjectURL(url);
  toast("Your data export is ready.", "success");
}

function handleTaskListClick(event) {
  const edit = event.target.closest("[data-edit-task]");
  const remove = event.target.closest("[data-delete-task]");
  const details = event.target.closest("[data-task-details]");
  if (edit) openTaskForm(tasks.find(task => task.id === edit.dataset.editTask));
  else if (remove) deleteTask(remove.dataset.deleteTask);
  else if (details) showTaskDetails(details.dataset.taskDetails);
}

document.getElementById("taskForm").addEventListener("submit", saveTask);
document.getElementById("categoryForm").addEventListener("submit", saveCategory);
document.getElementById("taskList").addEventListener("click", handleTaskListClick);
document.getElementById("taskList").addEventListener("change", event => {
  const id = event.target.dataset.toggleTask;
  if (!id) return;
  const task = tasks.find(item => item.id === id);
  if (task) {
    setTaskCompleted(task, event.target.checked);
    persistTasks();
    toast(task.completed ? "Nicely done. One less thing to carry." : "Task moved back to your active list.", "success");
  }
});
document.getElementById("taskList").addEventListener("dragstart", event => {
  const card = event.target.closest(".task-card");
  if (!card || document.getElementById("sortSelect").value !== "manual") return;
  draggedTaskId = card.dataset.taskId;
  card.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedTaskId);
});
document.getElementById("taskList").addEventListener("dragend", event => event.target.closest(".task-card")?.classList.remove("is-dragging"));
document.getElementById("taskList").addEventListener("dragover", event => {
  const target = event.target.closest(".task-card");
  if (target && draggedTaskId && target.dataset.taskId !== draggedTaskId) {
    event.preventDefault();
    target.classList.add("drag-over");
  }
});
document.getElementById("taskList").addEventListener("dragleave", event => event.target.closest(".task-card")?.classList.remove("drag-over"));
document.getElementById("taskList").addEventListener("drop", event => {
  const target = event.target.closest(".task-card");
  if (!target || !draggedTaskId) return;
  event.preventDefault();
  const sourceIndex = tasks.findIndex(task => task.id === draggedTaskId);
  const targetIndex = tasks.findIndex(task => task.id === target.dataset.taskId);
  if (sourceIndex < 0 || targetIndex < 0) return;
  const [moved] = tasks.splice(sourceIndex, 1);
  tasks.splice(targetIndex, 0, moved);
  tasks.forEach((task, index) => { task.order = index; });
  draggedTaskId = "";
  persistTasks();
});
document.getElementById("filterTabs").addEventListener("click", event => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  currentFilter = button.dataset.filter;
  updateFilterTabs();
  renderTaskList();
});
document.getElementById("categoryNav").addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  setView("all", true);
  renderCategoryNavigation();
});
document.getElementById("categoryChips").addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  document.getElementById("breadcrumbCurrent").textContent = selectedCategory || "My Tasks";
  document.getElementById("tasksTitle").textContent = selectedCategory ? `${selectedCategory} tasks` : "My tasks";
  renderCategoryNavigation();
  renderTaskList();
});
document.getElementById("categoryCards").addEventListener("click", event => {
  const edit = event.target.closest("[data-edit-category]");
  const remove = event.target.closest("[data-delete-category]");
  if (edit) openCategoryForm(edit.dataset.editCategory);
  if (remove) deleteCategory(remove.dataset.deleteCategory);
});
document.getElementById("categoryNav").addEventListener("dblclick", event => {
  const button = event.target.closest("[data-category]");
  if (button && !["Personal", "Study", "Work", "Shopping", "Health", "Other"].includes(button.dataset.category)) openCategoryForm(button.dataset.category);
});
document.getElementById("categoryChips").addEventListener("dblclick", event => {
  const button = event.target.closest("[data-category]");
  if (button && button.dataset.category && !["Personal", "Study", "Work", "Shopping", "Health", "Other"].includes(button.dataset.category)) openCategoryForm(button.dataset.category);
});
document.getElementById("searchInput").addEventListener("input", () => {
  if (currentView !== "all" && currentView !== "today" && currentView !== "upcoming" && currentView !== "completed") setView("all");
  renderTaskList();
});
document.getElementById("sortSelect").addEventListener("change", renderTaskList);
document.getElementById("chartPeriod").addEventListener("change", () => renderDashboard(tasks, categories, document.getElementById("chartPeriod").value));
document.getElementById("clearCompleted").addEventListener("click", clearCompleted);
document.getElementById("addSubtaskField").addEventListener("click", () => addSubtaskField());
document.getElementById("subtaskFields").addEventListener("click", event => {
  if (event.target.closest(".remove-subtask-field")) event.target.closest(".subtask-input-row").remove();
});
document.getElementById("taskDetails").addEventListener("change", event => {
  const id = event.target.dataset.toggleSubtask;
  if (!id) return;
  const task = tasks.find(item => item.id === detailTaskId);
  const subtask = task?.subtasks.find(item => item.id === id);
  if (!subtask) return;
  subtask.completed = event.target.checked;
  writeTasks(tasks);
  detailDialog.close();
  showTaskDetails(detailTaskId);
  renderDashboard(tasks, categories, document.getElementById("chartPeriod").value);
  renderTaskList();
});
document.getElementById("detailEditButton").addEventListener("click", () => {
  const task = tasks.find(item => item.id === detailTaskId);
  detailDialog.close();
  if (task) openTaskForm(task);
});
document.getElementById("addCategoryButton").addEventListener("click", () => openCategoryForm());
document.getElementById("addCategoryMain").addEventListener("click", () => openCategoryForm());
document.getElementById("themeToggle").addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
document.getElementById("settingsThemeButton").addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
document.getElementById("reminderWindow").addEventListener("change", event => {
  settings.reminderWindow = Number(event.target.value);
  writeSettings(settings);
  toast("Reminder preference saved.", "success");
});
document.getElementById("enableNotifications").addEventListener("click", async () => {
  if (settings.notificationsEnabled) {
    settings.notificationsEnabled = false;
    writeSettings(settings);
    updateSettingsUI();
    toast("Deadline reminders are disabled.", "success");
    return;
  }
  const permission = await requestNotificationPermission();
  if (permission === "granted") {
    settings.notificationsEnabled = true;
    writeSettings(settings);
    toast("Deadline reminders are enabled.", "success");
  } else if (permission === "denied") {
    settings.notificationsEnabled = false;
    writeSettings(settings);
    toast("Notifications were denied. You can allow them in your browser's site settings.", "warning");
  } else if (permission === "unsupported") {
    toast("This browser does not support desktop notifications.", "warning");
  } else {
    toast("Notification permission was not granted.", "warning");
  }
  updateSettingsUI();
});
document.getElementById("notificationButton").addEventListener("click", () => setView("settings"));
document.getElementById("exportData").addEventListener("click", exportData);
document.getElementById("menuToggle").addEventListener("click", () => {
  const open = document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("mobileScrim").classList.toggle("visible", open);
  document.getElementById("menuToggle").setAttribute("aria-expanded", String(open));
});
document.getElementById("mobileScrim").addEventListener("click", () => {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("mobileScrim").classList.remove("visible");
  document.getElementById("menuToggle").setAttribute("aria-expanded", "false");
});
document.body.addEventListener("click", event => {
  const navigation = event.target.closest("[data-view]");
  if (navigation) {
    event.preventDefault();
    setView(navigation.dataset.view);
  }
  if (event.target.closest("[data-open-task]")) openTaskForm();
  if (event.target.closest("[data-close-dialog]")) event.target.closest("dialog").close();
  const compact = event.target.closest("[data-task-details]");
  if (compact && !compact.closest("#taskList")) showTaskDetails(compact.dataset.taskDetails);
});
document.addEventListener("keydown", event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.getElementById("searchInput").focus();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
    event.preventDefault();
    openTaskForm();
  }
  if (event.key === "Escape") {
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("mobileScrim").classList.remove("visible");
  }
});
window.addEventListener("daylight-storage-error", () => toast("Your browser could not save this change. Check your storage settings.", "warning"));
window.addEventListener("storage", event => {
  if (event.key === "daylight.tasks.v1") {
    tasks = readTasks();
    renderAll();
  }
});

renderAll();
setView("dashboard");
checkReminders(tasks, settings, (message, type, key) => toast(message, type, key));
window.setInterval(() => checkReminders(tasks, settings, (message, type, key) => toast(message, type, key)), 60_000);
