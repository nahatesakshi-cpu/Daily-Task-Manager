import { isDueToday, isOverdue, isUpcoming, formatDate, toDateKey } from "./tasks.js";

const COLORS = ["#9b7ebd", "#f4bfa8", "#91b89a", "#d77a85", "#c4a9d8", "#d8b889", "#a9a078", "#b4879e"];
let productivityChart;
let categoryChart;
let priorityChart;
let dailyChart;

export function renderDashboard(tasks, categories, period = "week") {
  const completed = tasks.filter(task => task.completed).length;
  const pending = tasks.length - completed;
  const overdue = tasks.filter(task => isOverdue(task)).length;
  const todayCompleted = tasks.filter(task => task.completed && task.completedAt && toDateKey(new Date(task.completedAt)) === toDateKey(new Date())).length;
  const rate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  setText("statTotal", tasks.length);
  setText("statCompleted", completed);
  setText("statPending", pending);
  setText("statOverdue", overdue);
  setText("navTaskCount", pending);
  setText("completionRate", `${rate}%`);
  setText("completedToday", `${todayCompleted} today`);
  setText("analyticsTotal", tasks.length);
  setText("analyticsCompleted", completed);
  setText("analyticsPending", pending);
  setText("analyticsRate", `${rate}%`);
  setWidth("totalTrack", tasks.length ? 100 : 0);
  setWidth("completedTrack", rate);
  setWidth("pendingTrack", tasks.length ? (pending / tasks.length) * 100 : 0);
  setWidth("overdueTrack", tasks.length ? (overdue / tasks.length) * 100 : 0);
  setWidth("productivityBar", rate);
  renderCompactList("priorityList", tasks.filter(task => !task.completed && isDueToday(task)).sort(prioritySort).slice(0, 4), "No priority tasks due today. Enjoy the breathing room.");
  renderCompactList("recentList", [...tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4), "New tasks will feel right at home here.");
  renderCompactList("deadlineList", tasks.filter(task => !task.completed && task.dueDate && (isUpcoming(task) || isDueToday(task))).sort(dueSort).slice(0, 4), "Your upcoming deadlines will show up here.");
  drawCharts(tasks, categories, period);
}

export function renderViewCharts(tasks, categories) {
  const categoryCounts = categories.map(category => tasks.filter(task => task.category === category).length);
  categoryChart = replaceChart(categoryChart, "categoryChart", {
    type: "doughnut",
    data: { labels: categories, datasets: [{ data: categoryCounts, backgroundColor: categories.map((_, index) => COLORS[index % COLORS.length]), borderWidth: 0, hoverOffset: 8 }] },
    options: doughnutOptions(categoryCounts.some(Boolean))
  });
  const priorities = ["high", "medium", "low"];
  const priorityCounts = priorities.map(priority => tasks.filter(task => task.priority === priority).length);
  priorityChart = replaceChart(priorityChart, "priorityChart", {
    type: "doughnut",
    data: { labels: ["High", "Medium", "Low"], datasets: [{ data: priorityCounts, backgroundColor: ["#d77a85", "#f4bfa8", "#91b89a"], borderWidth: 0, hoverOffset: 8 }] },
    options: doughnutOptions(priorityCounts.some(Boolean))
  });
  dailyChart = replaceChart(dailyChart, "dailyChart", lineConfig(dailySeries(tasks, 7)));
}

function drawCharts(tasks, categories, period) {
  const days = period === "month" ? 30 : 7;
  productivityChart = replaceChart(productivityChart, "productivityChart", lineConfig(dailySeries(tasks, days)));
  renderViewCharts(tasks, categories);
}

function dailySeries(tasks, days) {
  const labels = [];
  const values = [];
  const now = new Date();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setDate(day.getDate() - offset);
    const key = toDateKey(day);
    labels.push(new Intl.DateTimeFormat(undefined, { weekday: days === 7 ? "short" : undefined, month: days === 30 ? "short" : undefined, day: "numeric" }).format(day));
    values.push(tasks.filter(task => task.completedAt && toDateKey(new Date(task.completedAt)) === key).length);
  }
  return { labels, values };
}

function lineConfig(series) {
  return {
    type: "line",
    data: { labels: series.labels, datasets: [{ label: "Completed", data: series.values, borderColor: "#9b7ebd", backgroundColor: "rgba(155, 126, 189, .14)", fill: true, tension: .4, pointBackgroundColor: "#9b7ebd", pointBorderColor: "#fff", pointRadius: 3, pointHoverRadius: 5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: "#393044", padding: 10, cornerRadius: 8 } },
      scales: { x: { grid: { display: false }, ticks: { color: cssVar("--text-soft"), maxTicksLimit: 8 } }, y: { beginAtZero: true, ticks: { precision: 0, color: cssVar("--text-soft") }, grid: { color: cssVar("--border") } } }
    }
  };
}

function doughnutOptions(hasData) {
  return {
    responsive: true, maintainAspectRatio: false, cutout: "68%",
    plugins: {
      legend: { position: "bottom", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, padding: 18, color: cssVar("--text-soft"), font: { family: "DM Sans" } } },
      tooltip: { enabled: hasData, backgroundColor: "#393044", padding: 10, cornerRadius: 8 }
    }
  };
}

function replaceChart(existing, id, config) {
  const canvas = document.getElementById(id);
  if (!canvas || typeof window.Chart !== "function") return existing;
  if (existing) existing.destroy();
  if (config.type === "doughnut" && !config.data.datasets[0].data.some(Boolean)) {
    config.data.datasets[0].data = [1];
    config.data.datasets[0].backgroundColor = [cssVar("--border")];
  }
  return new window.Chart(canvas, config);
}

function renderCompactList(id, tasks, emptyText) {
  const root = document.getElementById(id);
  if (!root) return;
  root.replaceChildren();
  if (!tasks.length) {
    const empty = document.createElement("p");
    empty.className = "compact-empty";
    empty.textContent = emptyText;
    root.appendChild(empty);
    return;
  }
  tasks.forEach(task => {
    const row = document.createElement("button");
    row.className = "compact-task";
    row.type = "button";
    row.dataset.taskDetails = task.id;
    const check = document.createElement("span");
    check.className = `compact-check priority-${task.priority}`;
    check.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.className = "compact-task-copy";
    const title = document.createElement("strong");
    title.textContent = task.title;
    const meta = document.createElement("small");
    meta.textContent = `${task.category}${task.dueDate ? ` · ${isOverdue(task) ? "Overdue" : isDueToday(task) ? "Today" : formatDate(task.dueDate)}` : ""}`;
    text.append(title, meta);
    const arrow = document.createElement("span");
    arrow.className = "compact-arrow";
    arrow.textContent = "↗";
    row.append(check, text, arrow);
    root.appendChild(row);
  });
}

function prioritySort(a, b) {
  const rank = { high: 0, medium: 1, low: 2 };
  return rank[a.priority] - rank[b.priority];
}

function dueSort(a, b) {
  return `${a.dueDate} ${a.dueTime}`.localeCompare(`${b.dueDate} ${b.dueTime}`);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setWidth(id, value) {
  const element = document.getElementById(id);
  if (element) element.style.width = `${Math.max(0, Math.min(100, value))}%`;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
