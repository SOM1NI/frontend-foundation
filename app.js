const state = {
  apiMode: false,
  token: localStorage.getItem("taskforge_token") || "",
  currentUser: null,
  tasks: [],
  categories: [],
  filter: "all"
};

const fallbackUser = {
  id: "local-admin",
  name: "Admin User",
  email: "admin@taskforge.dev",
  role: "admin"
};

const fallbackCategories = [
  { id: "cat-planning", name: "Planning", color: "#14746f" },
  { id: "cat-development", name: "Development", color: "#65336f" },
  { id: "cat-review", name: "Review", color: "#b67616" },
  { id: "cat-operations", name: "Operations", color: "#2f6f9f" }
];

const fallbackTasks = [
  {
    id: "task-1",
    title: "Wire task CRUD endpoints",
    details: "Create list, create, update, complete, and delete routes for todos.",
    category: "Development",
    priority: "High",
    dueDate: "2026-10-25",
    completed: false,
    comments: [
      { id: "comment-1", body: "Auth middleware is ready.", authorName: "Admin User", createdAt: new Date().toISOString() }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "task-2",
    title: "Prepare admin role matrix",
    details: "Map member, manager, and admin capabilities for the panel.",
    category: "Planning",
    priority: "Medium",
    dueDate: "2026-10-27",
    completed: false,
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "task-3",
    title: "Review category naming",
    details: "Keep category labels short enough for small screens.",
    category: "Review",
    priority: "Low",
    dueDate: "2026-10-29",
    completed: true,
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  collectElements();
  bindEvents();
  boot();
});

function collectElements() {
  els.status = document.querySelector("#connection-status");
  els.authForm = document.querySelector("#auth-form");
  els.registerButton = document.querySelector("#register-button");
  els.userName = document.querySelector("#user-name");
  els.userRole = document.querySelector("#user-role");
  els.userAvatar = document.querySelector("#user-avatar");
  els.categoryList = document.querySelector("#category-list");
  els.categorySelect = document.querySelector("#category-select");
  els.taskForm = document.querySelector("#task-form");
  els.taskList = document.querySelector("#task-list");
  els.filterButtons = Array.from(document.querySelectorAll("[data-filter]"));
  els.totalCount = document.querySelector("#total-count");
  els.doneCount = document.querySelector("#done-count");
  els.activeCount = document.querySelector("#active-count");
  els.apiResponse = document.querySelector("#api-response");
  els.responseMethod = document.querySelector("#response-method");
  els.commentForm = document.querySelector("#comment-form");
  els.commentTaskSelect = document.querySelector("#comment-task-select");
}

function bindEvents() {
  els.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await authenticate("login");
  });

  els.registerButton.addEventListener("click", async () => {
    await authenticate("register");
  });

  els.taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createTask(new FormData(els.taskForm));
  });

  els.commentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createComment(new FormData(els.commentForm));
  });

  els.filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      els.filterButtons.forEach((item) => item.classList.toggle("active", item === button));
      render();
    });
  });
}

async function boot() {
  const healthy = await pingApi();
  state.apiMode = healthy;
  setConnection(healthy);

  if (healthy && state.token) {
    await loadApiData();
    return;
  }

  loadFallbackData();
  render();
}

async function pingApi() {
  try {
    const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
    return response.ok;
  } catch (error) {
    return false;
  }
}

function setConnection(online) {
  els.status.textContent = online ? "API connected" : "Static demo mode";
  els.status.classList.toggle("offline", !online);
}

async function authenticate(action) {
  const form = new FormData(els.authForm);
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "").trim();
  const name = email.split("@")[0] || "New User";

  if (!email || !password) {
    showResponse("AUTH", { error: "Email and password are required." });
    return;
  }

  if (!state.apiMode) {
    state.currentUser = { ...fallbackUser, email, name: toTitle(name) };
    localStorage.setItem("taskforge_local_user", JSON.stringify(state.currentUser));
    showResponse("AUTH", { mode: "static", user: state.currentUser });
    render();
    return;
  }

  try {
    const response = await request(`/api/auth/${action}`, {
      method: "POST",
      body: { name: toTitle(name), email, password }
    }, false);

    state.token = response.token;
    localStorage.setItem("taskforge_token", state.token);
    state.currentUser = response.user;
    showResponse("AUTH", response);
    await loadApiData();
  } catch (error) {
    showResponse("AUTH", { error: error.message });
  }
}

async function loadApiData() {
  try {
    const [categoriesResult, tasksResult, userResult] = await Promise.all([
      request("/api/categories"),
      request("/api/tasks"),
      request("/api/auth/me")
    ]);

    state.categories = categoriesResult.categories;
    state.tasks = tasksResult.tasks;
    state.currentUser = userResult.user;
    showResponse("GET", { tasks: state.tasks });
    render();
  } catch (error) {
    state.token = "";
    localStorage.removeItem("taskforge_token");
    loadFallbackData();
    showResponse("ERROR", { error: error.message, mode: "static fallback" });
    render();
  }
}

function loadFallbackData() {
  const storedTasks = localStorage.getItem("taskforge_tasks");
  const storedUser = localStorage.getItem("taskforge_local_user");
  state.currentUser = storedUser ? JSON.parse(storedUser) : fallbackUser;
  state.categories = fallbackCategories;
  state.tasks = storedTasks ? JSON.parse(storedTasks) : fallbackTasks;
  persistFallback();
  showResponse("GET", { mode: "static", tasks: state.tasks });
}

async function createTask(formData) {
  const payload = {
    title: String(formData.get("title") || "").trim(),
    details: String(formData.get("details") || "").trim(),
    category: String(formData.get("category") || "Planning"),
    priority: String(formData.get("priority") || "Medium"),
    dueDate: String(formData.get("dueDate") || "")
  };

  if (!payload.title) {
    showResponse("POST", { error: "Task title is required." });
    return;
  }

  if (state.apiMode && state.token) {
    try {
      const result = await request("/api/tasks", { method: "POST", body: payload });
      state.tasks.unshift(result.task);
      els.taskForm.reset();
      showResponse("POST", result);
      render();
      return;
    } catch (error) {
      showResponse("POST", { error: error.message });
      return;
    }
  }

  const task = {
    id: makeBrowserId(),
    ...payload,
    completed: false,
    comments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.tasks.unshift(task);
  els.taskForm.reset();
  persistFallback();
  showResponse("POST", { task });
  render();
}

async function toggleTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  const completed = !task.completed;

  if (state.apiMode && state.token) {
    try {
      const result = await request(`/api/tasks/${id}`, { method: "PATCH", body: { completed } });
      state.tasks = state.tasks.map((item) => item.id === id ? result.task : item);
      showResponse("PATCH", result);
      render();
      return;
    } catch (error) {
      showResponse("PATCH", { error: error.message });
      return;
    }
  }

  task.completed = completed;
  task.updatedAt = new Date().toISOString();
  persistFallback();
  showResponse("PATCH", { task });
  render();
}

async function deleteTask(id) {
  if (state.apiMode && state.token) {
    try {
      const result = await request(`/api/tasks/${id}`, { method: "DELETE" });
      state.tasks = state.tasks.filter((task) => task.id !== id);
      showResponse("DELETE", result);
      render();
      return;
    } catch (error) {
      showResponse("DELETE", { error: error.message });
      return;
    }
  }

  state.tasks = state.tasks.filter((task) => task.id !== id);
  persistFallback();
  showResponse("DELETE", { deleted: id });
  render();
}

async function editTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;

  const title = prompt("Edit task title", task.title);
  if (!title || !title.trim()) return;

  const payload = { title: title.trim() };

  if (state.apiMode && state.token) {
    try {
      const result = await request(`/api/tasks/${id}`, { method: "PATCH", body: payload });
      state.tasks = state.tasks.map((item) => item.id === id ? result.task : item);
      showResponse("PATCH", result);
      render();
      return;
    } catch (error) {
      showResponse("PATCH", { error: error.message });
      return;
    }
  }

  task.title = payload.title;
  task.updatedAt = new Date().toISOString();
  persistFallback();
  showResponse("PATCH", { task });
  render();
}

async function createComment(formData) {
  const taskId = String(formData.get("taskId") || "");
  const body = String(formData.get("body") || "").trim();
  if (!taskId || !body) {
    showResponse("COMMENT", { error: "Choose a task and add a comment." });
    return;
  }

  if (state.apiMode && state.token) {
    try {
      const result = await request(`/api/tasks/${taskId}/comments`, { method: "POST", body: { body } });
      state.tasks = state.tasks.map((task) => task.id === taskId ? result.task : task);
      els.commentForm.reset();
      showResponse("COMMENT", result);
      render();
      return;
    } catch (error) {
      showResponse("COMMENT", { error: error.message });
      return;
    }
  }

  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;

  task.comments.push({
    id: makeBrowserId(),
    body,
    authorName: state.currentUser.name,
    createdAt: new Date().toISOString()
  });
  task.updatedAt = new Date().toISOString();
  persistFallback();
  els.commentForm.reset();
  showResponse("COMMENT", { task });
  render();
}

async function request(path, options = {}, includeAuth = true) {
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {})
  };

  if (includeAuth && state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

function persistFallback() {
  localStorage.setItem("taskforge_tasks", JSON.stringify(state.tasks));
}

function render() {
  renderUser();
  renderCategories();
  renderTasks();
  renderStats();
  renderCommentOptions();
}

function renderUser() {
  const user = state.currentUser || fallbackUser;
  els.userName.textContent = user.name;
  els.userRole.textContent = user.role;
  els.userAvatar.textContent = (user.name || user.email || "A").charAt(0).toUpperCase();
}

function renderCategories() {
  els.categoryList.innerHTML = state.categories.map((category) => `
    <li>
      <span><span class="category-dot" style="background:${category.color}"></span> ${escapeHtml(category.name)}</span>
      <strong>${state.tasks.filter((task) => task.category === category.name).length}</strong>
    </li>
  `).join("");

  els.categorySelect.innerHTML = state.categories.map((category) => (
    `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`
  )).join("");
}

function renderTasks() {
  const visibleTasks = state.tasks.filter((task) => {
    if (state.filter === "active") return !task.completed;
    if (state.filter === "completed") return task.completed;
    return true;
  });

  if (!visibleTasks.length) {
    els.taskList.innerHTML = `<div class="empty-state">No tasks match this view.</div>`;
    return;
  }

  els.taskList.innerHTML = visibleTasks.map((task) => {
    const comments = task.comments?.length || 0;
    const due = task.dueDate ? formatDate(task.dueDate) : "No due date";
    const priorityClass = `priority-${String(task.priority || "medium").toLowerCase()}`;

    return `
      <article class="task-card ${task.completed ? "completed" : ""}">
        <button class="task-check" type="button" data-action="toggle" data-id="${task.id}" aria-label="Toggle ${escapeHtml(task.title)}">${task.completed ? "OK" : ""}</button>
        <div class="task-body">
          <h3>${escapeHtml(task.title)}</h3>
          <p>${escapeHtml(task.details || "No details added.")}</p>
          <div class="meta-row">
            <span>${escapeHtml(task.category || "General")}</span>
            <span class="${priorityClass}">${escapeHtml(task.priority || "Medium")}</span>
            <span>${due}</span>
            <span>${comments} comments</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="icon-button" type="button" data-action="edit" data-id="${task.id}">Edit</button>
          <button class="icon-button danger" type="button" data-action="delete" data-id="${task.id}">Delete</button>
        </div>
      </article>
    `;
  }).join("");

  els.taskList.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.id;
      if (button.dataset.action === "toggle") toggleTask(id);
      if (button.dataset.action === "edit") editTask(id);
      if (button.dataset.action === "delete") deleteTask(id);
    });
  });
}

function renderStats() {
  const total = state.tasks.length;
  const done = state.tasks.filter((task) => task.completed).length;
  els.totalCount.textContent = total;
  els.doneCount.textContent = done;
  els.activeCount.textContent = total - done;
}

function renderCommentOptions() {
  if (!state.tasks.length) {
    els.commentTaskSelect.innerHTML = `<option value="">No tasks</option>`;
    return;
  }

  els.commentTaskSelect.innerHTML = state.tasks.map((task) => (
    `<option value="${task.id}">${escapeHtml(task.title)}</option>`
  )).join("");
}

function showResponse(method, payload) {
  els.responseMethod.textContent = method;
  els.apiResponse.textContent = JSON.stringify(payload, null, 2);
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function toTitle(value) {
  return value
    .split(/[._-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ") || "New User";
}

function makeBrowserId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
