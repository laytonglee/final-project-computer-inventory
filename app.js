const express = require("express");
const path = require("path");
const fs = require("fs");
const morgan = require("morgan");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("connect-flash");
const { engine } = require("express-handlebars");

const app = express();
app.set('trust proxy', 1); // required when running behind Render/nginx reverse proxy

// ── Ensure required directories exist ─────────────────────────────────────────
const logsDir = path.join(__dirname, "logs");
const uploadsDir = path.join(__dirname, "uploads");
[logsDir, uploadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Logging (morgan) ──────────────────────────────────────────────────────────
const accessLogStream = fs.createWriteStream(path.join(logsDir, "access.log"), {
  flags: "a",
});
app.use(morgan("combined", { stream: accessLogStream }));
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

// ── CORS (same-origin; adjust APP_URL for production) ─────────────────────────
app.use(
  cors({
    origin: process.env.APP_URL || "http://localhost:3000",
    credentials: true,
  }),
);

// ── Rate Limiting ───────────────────────────────────────────────────────────────
// Strict limiter for login endpoints — brute-force protection
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(429).json({
        error:
          "Too many login attempts. Please wait 15 minutes before trying again.",
      });
    }
    return res.status(429).render("login", {
      layout: "auth",
      pageTitle: "Login",
      errorMessages: [
        "Too many login attempts. Please wait 15 minutes before trying again.",
      ],
    });
  },
});

// General limiter — applied after static files so assets are exempt
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    if (req.path.startsWith("/api")) {
      return res
        .status(429)
        .json({ error: "Too many requests. Please wait before retrying." });
    }
    return res.status(429).render("error", {
      layout: "main",
      pageTitle: "Too Many Requests",
      message:
        "You are sending too many requests. Please slow down and try again in a moment.",
      code: 429,
    });
  },
});

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Session (only for connect-flash) ─────────────────────────────────────────
app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback-dev-secret-change-in-prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 60 * 60 * 1000, // 1 hour
    },
  }),
);
app.use(flash());

// ── Handlebars ────────────────────────────────────────────────────────────────
app.engine(
  "hbs",
  engine({
    extname: ".hbs",
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "views/layouts"),
    partialsDir: path.join(__dirname, "views/partials"),
    helpers: {
      eq: (a, b) => a == b,
      ne: (a, b) => a != b,
      gt: (a, b) => a > b,
      lt: (a, b) => a < b,
      and: (a, b) => a && b,
      or: (a, b) => a || b,
      not: (a) => !a,
      json: (obj) => JSON.stringify(obj),
      toString: (val) => String(val ?? ""),
      formatDate: (date) => {
        if (!date) return "—";
        return new Date(date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      },
      formatDateTime: (date) => {
        if (!date) return "—";
        return new Date(date).toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      },
      dateValue: (date) => {
        if (!date) return "";
        return new Date(date).toISOString().split("T")[0];
      },
      statusBadge: (status) => {
        const map = {
          Available: "success",
          "In-Use": "primary",
          Maintenance: "warning",
          Retired: "secondary",
        };
        return map[status] || "light";
      },
      roleBadge: (role) => (role === "Admin" ? "danger" : "info"),
      isAdmin: (role) => role === "Admin",
      includes: (arr, val) => Array.isArray(arr) && arr.includes(val),
      yearsAgo: (date) => {
        if (!date) return 0;
        return Math.floor(
          (Date.now() - new Date(date).getTime()) / (365.25 * 24 * 3600 * 1000),
        );
      },
      isOlderThan3Years: (date) => {
        if (!date) return false;
        const years =
          (Date.now() - new Date(date).getTime()) / (365.25 * 24 * 3600 * 1000);
        return years >= 3;
      },
    },
  }),
);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// ── Static files (served before rate limiting so assets are exempt) ─────────────
app.use(express.static(path.join(__dirname, "public")));

// ── Apply rate limiters ───────────────────────────────────────────────────────
app.use("/login", loginLimiter); // 10 attempts / 15 min
app.use("/api/auth", loginLimiter);
app.use(limiter); // 100 req / min for everything else

// ── Flash message locals ──────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.successMessages = req.flash("success");
  res.locals.errorMessages = req.flash("error");
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
// API routes MUST be registered before the UI router, because the UI router's
// authenticateUI middleware (mounted with no path) would otherwise intercept
// all unmatched requests — including /api/* — and redirect them to /login.
app.use("/api/auth", require("./src/routes/api/auth"));
app.use("/api/users", require("./src/routes/api/users"));
app.use("/api/items", require("./src/routes/api/items"));
app.use("/api/keys", require("./src/routes/api/keys"));
app.use("/api/transactions", require("./src/routes/api/transactions"));
app.use("/", require("./src/routes/ui/index"));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Endpoint not found." });
  }
  res.status(404).render("error", {
    layout: "main",
    pageTitle: "Not Found",
    message: "The page you are looking for does not exist.",
    code: 404,
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[ERROR]", err.stack || err.message);
  const status = err.status || 500;
  if (req.path.startsWith("/api")) {
    return res
      .status(status)
      .json({ error: err.message || "Internal server error." });
  }
  res.status(status).render("error", {
    layout: "main",
    pageTitle: "Error",
    message: err.message || "Something went wrong.",
    code: status,
  });
});

module.exports = app;
