# Daylight — Smart Productivity

A client-side productivity dashboard built with HTML5, CSS3, and vanilla JavaScript modules. Tasks, categories, display preferences, and reminder preferences are stored in the browser's Local Storage; no app server or account is required.

## Project structure

```text
todo-list-application/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── script.js
│   ├── storage.js
│   ├── tasks.js
│   ├── dashboard.js
│   └── notifications.js
└── README.md
```

## Run in VS Code

1. Open this project folder in VS Code.
2. Install or enable a static-server extension such as **Live Server**.
3. Right-click `index.html` and choose **Open with Live Server**. Alternatively, run `python -m http.server 5500` in the project folder and visit `http://localhost:5500`.
4. Chart.js is loaded from jsDelivr and the font families from Google Fonts. For offline use, the app still works without the fonts, but charts require Chart.js to be available.

Use an HTTP localhost address rather than opening the HTML directly as a `file://` URL. JavaScript modules and browser notification permissions are restricted in some browsers when a page is opened from a file.

## Features

- Dashboard with task counts, completion rate, overdue count, daily productivity, priorities, recently added tasks, and upcoming deadlines.
- Create, inspect, edit, complete/reactivate, and delete tasks, with descriptions, category, priority, due date/time, and checklists.
- Default and custom categories, category filtering, and safe custom-category deletion (affected tasks move to **Other**).
- All, active, completed, today, upcoming, overdue, and high-priority filters; live title/description/category search; manual, due-date, priority, creation-date, and title sorting.
- HTML drag-and-drop ordering in **My order** mode.
- Light and dark themes with a consistent cream, peach, sage, rose, and lavender palette.
- Local Storage persistence, legacy task migration from the original `tasks` key, and JSON export.
- Optional deadline notifications, overdue in-app alerts, and configurable reminder lead time.
- Responsive sidebar navigation, keyboard shortcuts, accessible labels, confirmation prompts, and transient toast feedback.

## Data and browser notifications

All task and preference data stays in this browser profile on this device. Clearing site data, switching browsers/devices, or using private browsing may remove or isolate it. Use **Settings → Export JSON** to download a backup.

Browser notifications are optional. The user must enable them in Settings and grant the browser's permission for this site. Browsers generally require a secure context (HTTPS or localhost), may suppress notifications based on device settings, and may restrict notifications when the page is closed; this app does not run a server or background service worker. If permission is denied, reminders remain off and the browser's site settings can be used to change that permission.

## Testing checklist

Run the app on localhost, then try:

1. Create a task with description, category, priority, due date/time, and subtasks. Refresh and verify that it remains.
2. Edit the task, complete it, reactivate it, and delete it (confirm both cancellation and confirmation).
3. Add, rename, and delete a custom category; verify tasks in a deleted category move to **Other**.
4. Test All, Active, Completed, Today, Upcoming, Overdue, High priority, category filters, and live search.
5. Change sorting and drag tasks while **My order** is selected; refresh to verify the order.
6. Toggle subtasks and verify the checklist count. Confirm completed tasks update the dashboard and statistics.
7. Switch themes, refresh, and verify the preference persists.
8. Enable notifications on localhost or HTTPS if supported; test denied/unsupported permission behavior as well.
9. Resize to a phone-width viewport and test the menu, task form, category views, and charts.

## JavaScript concepts used

- ES modules separate storage, task model logic, dashboard/chart rendering, notifications, and app orchestration.
- `document.createElement`, `appendChild`, `replaceChildren`, `classList`, and DOM event listeners build and update UI elements.
- Event delegation handles dynamic task, category, and checklist actions.
- `map`, `filter`, `find`, `forEach`, `sort`, and other array methods implement CRUD, filtering, and statistics.
- `JSON.parse` and `JSON.stringify` load and save Local Storage data with shape checks and fallback handling for invalid values.
- Native HTML drag-and-drop, `<dialog>`, browser notifications, and keyboard events provide browser-native interactions.

## Upload to GitHub

1. Create a new empty repository on GitHub.
2. Open a terminal in this project folder and run:

   ```powershell
   git init
   git add index.html css js README.md
   git commit -m "Build Daylight productivity dashboard"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
   git push -u origin main
   ```

3. Replace the sample GitHub URL with the repository URL. Keep the repository public if you want to publish the static app with GitHub Pages; then choose **Settings → Pages**, select the `main` branch and root folder, and save.
