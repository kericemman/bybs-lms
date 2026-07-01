import compression from "compression";
import cors from "cors";
import express from "express";
import mongoSanitize from "express-mongo-sanitize";
import helmet from "helmet";
import hpp from "hpp";
import mongoose from "mongoose";
import pinoHttp from "pino-http";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { mutationRateLimit } from "./middleware/mutationRateLimit.js";
import { notFound } from "./middleware/notFound.js";
import { assignRequestId } from "./middleware/requestId.js";
import { monitorRequestHealth } from "./middleware/requestHealth.js";
import { rejectUnsafePayload } from "./middleware/requestSecurity.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { apiRoutes } from "./routes/index.js";
import { logger } from "./utils/logger.js";

export const app = express();
app.disable("x-powered-by");

if (env.isProduction) {
  app.set("trust proxy", 1);
}

const allowedOrigins = [
  env.clientAdminUrl,
  env.clientMentorUrl,
  env.clientStudentUrl
].filter(Boolean);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "no-referrer" }
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      const error = new Error("Not allowed by CORS");
      error.statusCode = 403;
      callback(error);
    },
    credentials: true
  })
);
app.use(assignRequestId);
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id,
    autoLogging: {
      ignore: (req) => req.url === "/health" || req.url?.startsWith("/uploads")
    }
  })
);
app.use(compression());
app.use("/api", rateLimit({
  windowMs: env.globalRateLimitWindowMs,
  max: env.globalRateLimitMax,
  keyPrefix: "api"
}));
app.use(express.json({ limit: env.jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.jsonBodyLimit }));
app.use(hpp());
app.use(mongoSanitize({ replaceWith: "_" }));
app.use(rejectUnsafePayload);
app.use(
  "/uploads",
  express.static(env.uploadDir, {
    index: false,
    maxAge: env.isProduction ? "7d" : 0,
    setHeaders(res) {
      res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self' data:; media-src 'self'; sandbox");
      res.setHeader("X-Content-Type-Options", "nosniff");
    }
  })
);
app.use(monitorRequestHealth);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "bybs-lms-api" });
});

app.get("/ready", (_req, res) => {
  const isReady = mongoose.connection.readyState === 1;
  res.status(isReady ? 200 : 503).json({
    status: isReady ? "ready" : "not_ready",
    service: "bybs-lms-api"
  });
});

app.use("/api", mutationRateLimit);
app.use("/api", apiRoutes);
app.use(notFound);
app.use(errorHandler);
