const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "taskforge-dev-secret-change-me";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon"
};

ensureDatabase();

const server = http.createServer(async (req, res) => {
  try {
    setCors(res);

    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`TaskForge running at http://localhost:${PORT}`);
});

async function handleApi(req, res, url) {
  const pathname = url.pathname;
  const method = req.method;

  if (method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { status: "ok", name: "TaskForge API", time: new Date().toISOString() });
    return;
  }

  if (method === "POST" && pathname === "/api/auth/register") {
    const body = await readJson(req);
    const db = readDb();
    const email = normalizeEmail(body.email);
    requireFields(body, ["name", "password"]);

    if (!email) badRequest("A valid email is required.");
    if (db.users.some((user) => user.email === email)) conflict("That email is already registered.");

    const user = {
      id: makeId("user"),
      name: String(body.name).trim(),
      email,
      role: db.users.length === 0 ? "admin" : "member",
      passwordHash: hashPassword(String(body.password)),
      createdAt: new Date().toISOString()
    };

    db.users.push(user);
    writeDb(db);
    sendJson(res, 201, makeAuthPayload(user));
    return;
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await readJson(req);
    const db = readDb();
    const email = normalizeEmail(body.email);
    const user = db.users.find((item) => item.email === email);

    if (!user || !verifyPassword(String(body.password || ""), user.passwordHash)) {
      unauthorized("Invalid email or password.");
    }

    sendJson(res, 200, makeAuthPayload(user));
    return;
  }

  const session = requireAuth(req);

  if (method === "GET" && pathname === "/api/auth/me") {
    const user = readDb().users.find((item) => item.id === session.sub);
    if (!user) unauthorized("User session is no longer valid.");
    sendJson(res, 200, { user: publicUser(user) });
    return;
  }

  if (method === "GET" && pathname === "/api/categories") {
    sendJson(res, 200, { categories: readDb().categories });
    return;
  }

  if (method === "POST" && pathname === "/api/categories") {
    requireRole(session, ["admin", "manager"]);
    const body = await readJson(req);
    requireFields(body, ["name"]);
    const db = readDb();
    const category = {
      id: makeId("cat"),
      name: String(body.name).trim(),
      color: String(body.color || "#14746f"),
      createdAt: new Date().toISOString()
    };
    db.categories.push(category);
    writeDb(db);
    sendJson(res, 201, { category });
    return;
  }

  if (method === "GET" && pathname === "/api/tasks") {
    const db = readDb();
    const tasks = visibleTasks(db.tasks, session).sort(byUpdatedAt);
    sendJson(res, 200, { tasks });
    return;
  }

  if (method === "POST" && pathname === "/api/tasks") {
    const body = await readJson(req);
    requireFields(body, ["title"]);
    const db = readDb();
    const now = new Date().toISOString();
    const task = {
      id: makeId("task"),
      title: String(body.title).trim(),
      details: String(body.details || "").trim(),
      category: String(body.category || "Planning"),
      priority: normalizePriority(body.priority),
      dueDate: String(body.dueDate || ""),
      completed: false,
      ownerId: session.sub,
      assignee: String(body.assignee || ""),
      comments: [],
      createdAt: now,
      updatedAt: now
    };

    db.tasks.push(task);
    writeDb(db);
    sendJson(res, 201, { task });
    return;
  }

  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && method === "PATCH") {
    const db = readDb();
    const task = findPermittedTask(db, taskMatch[1], session);
    const body = await readJson(req);
    const editableFields = ["title", "details", "category", "priority", "dueDate", "completed", "assignee"];

    editableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        task[field] = field === "priority" ? normalizePriority(body[field]) : body[field];
      }
    });

    task.updatedAt = new Date().toISOString();
    writeDb(db);
    sendJson(res, 200, { task });
    return;
  }

  if (taskMatch && method === "DELETE") {
    const db = readDb();
    const task = findPermittedTask(db, taskMatch[1], session);
    db.tasks = db.tasks.filter((item) => item.id !== task.id);
    writeDb(db);
    sendJson(res, 200, { deleted: task.id });
    return;
  }

  const commentMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/comments$/);
  if (commentMatch && method === "POST") {
    const db = readDb();
    const task = findPermittedTask(db, commentMatch[1], session);
    const body = await readJson(req);
    requireFields(body, ["body"]);
    const author = db.users.find((user) => user.id === session.sub);
    const comment = {
      id: makeId("comment"),
      body: String(body.body).trim(),
      authorId: session.sub,
      authorName: author ? author.name : "Unknown",
      createdAt: new Date().toISOString()
    };
    task.comments.push(comment);
    task.updatedAt = new Date().toISOString();
    writeDb(db);
    sendJson(res, 201, { task, comment });
    return;
  }

  if (method === "GET" && pathname === "/api/admin/users") {
    requireRole(session, ["admin"]);
    const users = readDb().users.map(publicUser);
    sendJson(res, 200, { users });
    return;
  }

  notFound("Route not found.");
}

function serveStatic(req, res, url) {
  let requestPath = decodeURIComponent(url.pathname);
  if (requestPath === "/") requestPath = "/index.html";

  const filePath = path.normalize(path.join(ROOT, requestPath));
  const relativePath = path.relative(ROOT, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    forbidden("Invalid file path.");
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      sendFile(res, path.join(ROOT, "index.html"));
      return;
    }

    sendFile(res, filePath);
  });
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(httpError(413, "Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(httpError(400, "Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function readDb() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, `${JSON.stringify(db, null, 2)}\n`);
}

function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) return;

  const now = new Date().toISOString();
  const admin = {
    id: "user-admin",
    name: "Admin User",
    email: "admin@taskforge.dev",
    role: "admin",
    passwordHash: hashPassword("admin123"),
    createdAt: now
  };

  const db = {
    users: [admin],
    categories: [
      { id: "cat-planning", name: "Planning", color: "#14746f", createdAt: now },
      { id: "cat-development", name: "Development", color: "#65336f", createdAt: now },
      { id: "cat-review", name: "Review", color: "#b67616", createdAt: now },
      { id: "cat-operations", name: "Operations", color: "#2f6f9f", createdAt: now }
    ],
    tasks: [
      {
        id: "task-seed-1",
        title: "Connect frontend to the Todo API",
        details: "Use bearer auth, render task cards, and show API responses in the dashboard.",
        category: "Development",
        priority: "High",
        dueDate: "2026-10-25",
        completed: false,
        ownerId: admin.id,
        assignee: "Admin User",
        comments: [
          {
            id: "comment-seed-1",
            body: "Seed data loaded with the local Node server.",
            authorId: admin.id,
            authorName: admin.name,
            createdAt: now
          }
        ],
        createdAt: now,
        updatedAt: now
      },
      {
        id: "task-seed-2",
        title: "Publish API documentation page",
        details: "List auth, task, category, comment, and admin endpoints.",
        category: "Planning",
        priority: "Medium",
        dueDate: "2026-10-27",
        completed: true,
        ownerId: admin.id,
        assignee: "Admin User",
        comments: [],
        createdAt: now,
        updatedAt: now
      }
    ]
  };

  writeDb(db);
}

function makeAuthPayload(user) {
  return {
    token: signToken({ sub: user.id, role: user.role, email: user.email }),
    user: publicUser(user)
  };
}

function signToken(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12
  };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedBody = base64url(JSON.stringify(body));
  const signature = sign(`${encodedHeader}.${encodedBody}`);
  return `${encodedHeader}.${encodedBody}.${signature}`;
}

function requireAuth(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) unauthorized("Bearer token is required.");

  const [encodedHeader, encodedBody, signature] = token.split(".");
  if (!encodedHeader || !encodedBody || !signature) unauthorized("Bearer token is malformed.");

  const expected = sign(`${encodedHeader}.${encodedBody}`);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    unauthorized("Bearer token signature is invalid.");
  }

  const payload = JSON.parse(Buffer.from(encodedBody, "base64url").toString("utf8"));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    unauthorized("Bearer token has expired.");
  }

  return payload;
}

function requireRole(session, roles) {
  if (!roles.includes(session.role)) {
    forbidden("Your role cannot access this resource.");
  }
}

function findPermittedTask(db, id, session) {
  const task = db.tasks.find((item) => item.id === id);
  if (!task) notFound("Task not found.");

  const canAccess = session.role === "admin" || session.role === "manager" || task.ownerId === session.sub;
  if (!canAccess) forbidden("You cannot modify this task.");

  return task;
}

function visibleTasks(tasks, session) {
  if (session.role === "admin" || session.role === "manager") return tasks;
  return tasks.filter((task) => task.ownerId === session.sub);
}

function byUpdatedAt(a, b) {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizePriority(value) {
  const priority = String(value || "Medium").toLowerCase();
  if (priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Medium";
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("base64url");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const attempted = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("base64url");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(attempted));
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(value) {
  return crypto.createHmac("sha256", JWT_SECRET).update(value).digest("base64url");
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function requireFields(body, fields) {
  const missing = fields.filter((field) => !String(body[field] || "").trim());
  if (missing.length) badRequest(`Missing required field: ${missing.join(", ")}.`);
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  if (status === 204) {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload, null, 2));
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function badRequest(message) {
  throw httpError(400, message);
}

function unauthorized(message) {
  throw httpError(401, message);
}

function forbidden(message) {
  throw httpError(403, message);
}

function notFound(message) {
  throw httpError(404, message);
}

function conflict(message) {
  throw httpError(409, message);
}
