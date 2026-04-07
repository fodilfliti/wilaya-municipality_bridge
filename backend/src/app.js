const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const expressStatic = require("express").static;
const pinoHttp = require("pino-http");

const { ensureStorageDirs } = require("./services/storage");
const { authRouter } = require("./routes/auth");
const { adminRouter } = require("./routes/admin");
const { muniRouter } = require("./routes/muni");
const { requestContext } = require("./middleware/requestContext");
const { errorHandler } = require("./middleware/errorHandler");
const { getEnv } = require("./config/env");
const { getLogger } = require("./logger");

const app = express();

const env = getEnv();
const logger = getLogger();

app.set("trust proxy", Boolean(env.trustProxy));

app.use(requestContext);
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.requestId,
    autoLogging: {
      ignore: (req) => req.url === "/health" || req.url.startsWith("/files/")
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.originalUrl || req.url,
          remoteAddress: req.remoteAddress,
          remotePort: req.remotePort
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      }
    },
    customProps: (req) => ({
      requestId: req.requestId,
      userId: req.user?.id
    }),
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customSuccessMessage: (req, res) => {
      const url = req.originalUrl || req.url;
      return `HTTP ${req.method} ${url} ${res.statusCode}`;
    },
    customErrorMessage: (req, res, err) => {
      const url = req.originalUrl || req.url;
      return `HTTP ${req.method} ${url} ${res.statusCode} (${err?.message || "error"})`;
    }
  })
);

app.use(
  helmet({
    // Allow frontend (different origin) to load logos/files from `/files/*`
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

const corsOrigin = env.corsOrigin
  ? env.corsOrigin
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

app.use(
  cors({
    origin: corsOrigin || (env.nodeEnv !== "production" ? true : false),
    credentials: Boolean(corsOrigin && corsOrigin.length),
    maxAge: 600
  })
);

app.use(
  rateLimit({
    windowMs: env.rateLimitWindowMs,
    max: env.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false
  })
);
app.use(express.json({ limit: "2mb" }));

ensureStorageDirs();

app.get("/health", (req, res) => res.json({ ok: true }));

const storageRoot = process.env.FILE_STORAGE_ROOT
  ? path.isAbsolute(process.env.FILE_STORAGE_ROOT)
    ? process.env.FILE_STORAGE_ROOT
    : path.resolve(process.cwd(), process.env.FILE_STORAGE_ROOT)
  : path.resolve(process.cwd(), "storage");

app.use("/files", expressStatic(storageRoot, { fallthrough: false }));

app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/muni", muniRouter);

app.use(errorHandler);

module.exports = { app };

