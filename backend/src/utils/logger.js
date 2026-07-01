import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: process.env.LOG_LEVEL || (env.isProduction ? "info" : "debug"),
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.passwordHash",
      "req.body.token",
      "req.body.accessToken",
      "req.body.refreshToken"
    ],
    remove: true
  }
});
