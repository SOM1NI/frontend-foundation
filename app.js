const STORAGE_KEY = "simple_todo_tasks";

const state = {
  tasks: [],
  filter: "all",
  search: ""
};

const defaultTasks = [
  {
    id: "task-1",
    title: "Buy groceries",
    dueDate: "",
    priority: "Normal",
    done: false,
    createdAt: Date.now() - 3000
  },
  {
    id: "task-2",
    title: "Finish front-end assignment",
    dueDate: "",
    priority: "High",
    done: false,
    createdAt: Date.now() - 2000
  },
  {
    id: "task-3",
    title: "Clean study table",
    dueDate: "",
    priority: "Low",
    done: true,
    createdAt: Date.now() - 1000
  }
];

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  collectElements();
  bindEvents();
  loadTasks();
  render();
});

function collectElements() {
  elements.todayLabel = document.querySelector("#today-label");
  elements.form = document.querySelector("#task-form");
  elements.titleInput = document.querySelector("#task-title");
  elements.list = document.querySelector("#task-list");
  elements.emptyState = document.querySelector("#empty-state");
  elements.totalCount = document.querySelector("#total-count");
  elements.activeCount = document.querySelector("#active-count");
  elements.doneCount = document.querySelector("#done-count");
  elements.clearDone = document.querySelector("#clear-done");
  elements.search = document.querySelector("#search");
  elements.filters = Array.from(document.querySelectorAll("[data-filter]"));
}

function bindEvents() {
  elements.todayLabel.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

  elements.form.addEventListener("submit", (event) => {
    event.preventDefault();
    addTask(new FormData(elements.form));
  });

  elements.clearDone.addEventListener("click", () => {
    state.tasks = state.tasks.filter((task) => !task.done);
    saveTasks();
    render();
  });

  elements.search.addEventListener("input", () => {
    state.search = elements.search.value.trim().toLowerCase();
    render();
  });

  elements.filters.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      elements.filters.forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      render();
    });
  });
}

function loadTasks() {
  const saved = localStorage.getItem(STORAGE_KEY);
  state.tasks = saved ? JSON.parse(saved) : defaultTasks;
  saveTasks();
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function addTask(formData) {
  const title = String(formData.get("title") || "").trim();
  const dueDate = String(formData.get("dueDate") || "");
  const priority = String(formData.get("priority") || "Normal");

  if (!title) return;

  state.tasks.unshift({
    id: createId(),
    title,
    dueDate,
    priority,
    done: false,
    createdAt: Date.now()
  });

  elements.form.reset();
  elements.titleInput.focus();
  saveTasks();
  render();
}

function render() {
  renderCounts();
  renderTasks();
}

function renderCounts() {
  const total = state.tasks.length;
  const done = state.tasks.filter((task) => task.done).length;

  elements.totalCount.textContent = total;
  elements.doneCount.textContent = done;
  elements.activeCount.textContent = total - done;
  elements.clearDone.disabled = done === 0;
}

function renderTasks() {
  const tasks = getVisibleTasks();
  elements.emptyState.hidden = tasks.length > 0;
  elements.list.innerHTML = "";

  tasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `task-item${task.done ? " done" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.className = "task-check";
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", `Mark ${task.title} as done`);
    checkbox.addEventListener("change", () => toggleTask(task.id));

    const main = document.createElement("div");
    main.className = "task-main";

    const title = document.createElement("div");
    title.className = "task-title";
    title.textContent = task.title;

    const meta = document.createElement("div");
    meta.className = "task-meta";
    meta.append(
      makeTag(task.priority, task.priority.toLowerCase()),
      makeTag(task.dueDate ? formatDate(task.dueDate) : "No due date")
    );

    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editButton = document.createElement("button");
    editButton.className = "icon-button";
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => editTask(task.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "icon-button delete";
    deleteButton.type = "button";
    deleteButton.textContent = "Del";
    deleteButton.addEventListener("click", () => deleteTask(task.id));

    actions.append(editButton, deleteButton);
    item.append(checkbox, main, actions);
    elements.list.append(item);
  });
}

function getVisibleTasks() {
  return state.tasks.filter((task) => {
    const matchesFilter =
      state.filter === "all" ||
      (state.filter === "active" && !task.done) ||
      (state.filter === "done" && task.done);

    const matchesSearch = task.title.toLowerCase().includes(state.search);

    return matchesFilter && matchesSearch;
  });
}

function toggleTask(id) {
  state.tasks = state.tasks.map((task) => (
    task.id === id ? { ...task, done: !task.done } : task
  ));
  saveTasks();
  render();
}

function editTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  const nextTitle = prompt("Edit task", task.title);
  if (!nextTitle || !nextTitle.trim()) return;

  task.title = nextTitle.trim();
  saveTasks();
  render();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((task) => task.id !== id);
  saveTasks();
  render();
}

function makeTag(text, className = "") {
  const tag = document.createElement("span");
  tag.className = `tag ${className}`.trim();
  tag.textContent = text;
  return tag;
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
