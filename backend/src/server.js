import { app } from "./app.js";
import { connectDatabase, stopDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { ensureSuperAdmin } from "./services/adminSeedService.js";

let server = null;
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`${signal} received. Closing BYBS LMS API gracefully.`);

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await stopDatabase();
  process.exit(0);
}

async function bootstrap() {
  await connectDatabase();
  await ensureSuperAdmin();

  server = app.listen(env.port, () => {
    console.log(`BYBS LMS API running on port ${env.port}`);
  });

  server.requestTimeout = env.requestTimeoutMs;
  server.keepAliveTimeout = env.keepAliveTimeoutMs;
  server.headersTimeout = env.headersTimeoutMs;
}

process.on("SIGTERM", () => shutdown("SIGTERM").catch((error) => {
  console.error("Graceful shutdown failed", error);
  process.exit(1);
}));

process.on("SIGINT", () => shutdown("SIGINT").catch((error) => {
  console.error("Graceful shutdown failed", error);
  process.exit(1);
}));

bootstrap().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
