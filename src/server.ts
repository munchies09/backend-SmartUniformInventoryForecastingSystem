import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import compression from "compression";

import uniformRoutes from "./routes/uniformRoutes";
import memberRoutes from "./routes/memberRoutes";
import batchRoutes from "./routes/batchRoutes";
import announcementRoutes from "./routes/announcementRoutes";
import reportsRoutes from "./routes/reportsRoutes";
import forecastRoutes from "./routes/forecastRoutes";
import recommendedStockRoutes from "./routes/recommendedStockRoutes";

// ===============================
// BOOTSTRAP
// ===============================
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("❌ Missing MONGODB_URI in .env");
  process.exit(1);
}

// ===============================
// SAFETY: CRASH HANDLING (DON'T RUN BROKEN PROCESS)
// ===============================
// If Node has uncaught exception / unhandled rejection, best practice is exit and let nodemon/pm2 restart.
process.on("uncaughtException", (err) => {
  console.error("❌ UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ UNHANDLED REJECTION:", reason);
  process.exit(1);
});

// ===============================
// MONGOOSE SETTINGS (PREVENT HANGING)
// ===============================
// Prevent Mongoose from buffering queries when DB is down (this is the BIG "loading too long" cause)
mongoose.set("bufferCommands", false);
mongoose.set("bufferTimeoutMS", 5000);

// Optional: better logs while debugging
if (process.env.NODE_ENV === "development") {
  mongoose.set("debug", false);
}

// ===============================
// MIDDLEWARE
// ===============================

// gzip compress responses (faster downloads)
app.use(compression());

// CORS
const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:3000";
app.use(
  cors({
    origin: (origin, cb) => {
      // allow no-origin requests (Postman / curl / server-to-server)
      if (!origin) return cb(null, true);

      // dev: allow localhost
      if (process.env.NODE_ENV !== "production") return cb(null, true);

      // prod: only allow FRONTEND_URL
      if (origin === allowedOrigin) return cb(null, true);

      return cb(new Error("CORS blocked: Origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsing
// NOTE: If you upload base64 images, prefer doing it in a dedicated endpoint / multipart.
// Keep these smaller so normal API stays fast.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Normalize URLs (remove double slashes)
app.use((req, _res, next) => {
  req.url = req.url.replace(/\/+/g, "/");
  next();
});

// Request logger (only slow requests in production)
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  (req as any).requestId = requestId;

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1_000_000;

    const isSlow = ms > 1500;
    if (process.env.NODE_ENV === "development" || isSlow) {
      console.log(
        `${isSlow ? "🐢 SLOW" : "✅"} [${requestId}] ${req.method} ${req.originalUrl} -> ${
          res.statusCode
        } (${Math.round(ms)}ms) db=${mongoose.connection.readyState}`
      );
    }
  });

  next();
});

// Hard request timeout protection (server side)
const REQUEST_TIMEOUT_MS = 30000; // 30s (do not keep users waiting 90s)
app.use((req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        message: "Request timeout - server took too long to respond.",
      });
    }
  }, REQUEST_TIMEOUT_MS);

  res.on("finish", () => clearTimeout(timer));
  res.on("close", () => clearTimeout(timer));
  next();
});

// ===============================
// HEALTH CHECK (BOTH /health and /api/health)
// ===============================
const healthHandler = (_req: express.Request, res: express.Response) => {
  const state = mongoose.connection.readyState; // 0,1,2,3
  const dbStatus =
    state === 1 ? "connected" : state === 2 ? "connecting" : state === 3 ? "disconnecting" : "disconnected";

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: dbStatus,
    dbState: state,
    uptime: process.uptime(),
  });
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// ===============================
// FAIL FAST WHEN DB IS NOT CONNECTED
// ===============================
// IMPORTANT: put this BEFORE routes.
// If DB is down, do NOT let requests hang.
app.use((req, res, next) => {
  if (req.path === "/health" || req.path === "/api/health") return next();

  const state = mongoose.connection.readyState;
  if (state !== 1) {
    return res.status(503).json({
      success: false,
      message: "Database not connected. Please try again in a moment.",
      dbState: state,
    });
  }

  next();
});

// ===============================
// ROUTES
// ===============================
app.use("/api/uniforms", uniformRoutes);
app.use("/api/inventory", uniformRoutes); // Alias for frontend compatibility
app.use("/api/members", memberRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/forecast", forecastRoutes);
app.use("/api/recommended-stock", recommendedStockRoutes);

// ===============================
// ERROR HANDLERS
// ===============================

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("❌ Global error:", err);

  if (res.headersSent) return;

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ===============================
// DB CONNECT (WITH SAFE RECONNECT GUARD)
// ===============================
let isConnecting = false;

async function connectDB(retries = 3, delay = 5000) {
  // Guard: do not spam connect() if already connected/connecting
  const state = mongoose.connection.readyState;
  if (state === 1 || state === 2 || isConnecting) return;

  isConnecting = true;

  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(MONGO_URI!, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 30000,
        maxPoolSize: 10,
        minPoolSize: 0,
        retryWrites: true,
        retryReads: true,
      });

      console.log("✅ MongoDB connected");
      isConnecting = false;
      return;
    } catch (err: any) {
      console.error(`❌ MongoDB connect attempt ${i + 1}/${retries} failed:`, err?.message || err);

      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  isConnecting = false;
  console.error("❌ All MongoDB connection attempts failed (server still running).");
}

// Connection event handlers (set once)
mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected.");
  setTimeout(() => {
    // Only reconnect if still disconnected
    if (mongoose.connection.readyState === 0) {
      console.warn("🔁 Reconnecting MongoDB...");
      connectDB(3, 5000).catch(() => {});
    }
  }, 2000);
});

// ===============================
// START SERVER
// ===============================
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  connectDB().catch(() => {});
});

// Node HTTP timeouts (keep reasonable)
server.requestTimeout = REQUEST_TIMEOUT_MS; // Node 18+
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// ===============================
// GRACEFUL SHUTDOWN
// ===============================
function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down...`);

  server.close(async () => {
    console.log("✅ HTTP server closed");
    try {
      await mongoose.connection.close();
      console.log("✅ MongoDB connection closed");
      process.exit(0);
    } catch (err) {
      console.error("❌ Error closing MongoDB:", err);
      process.exit(1);
    }
  });

  setTimeout(() => {
    console.error("❌ Force shutdown");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
