import mongoose from "mongoose";
import { mkdir } from "node:fs/promises";
import { env } from "./env.js";

let memoryServer = null;

export async function connectDatabase() {
  let uri = env.mongodbUri;

  if (uri === "memory") {
    if (env.isProduction) {
      throw new Error("In-memory MongoDB is not allowed in production.");
    }

    const { MongoMemoryServer } = await import("mongodb-memory-server-core");
    await mkdir(env.mongoMemoryDownloadDir, { recursive: true });
    await mkdir(env.mongoMemoryDbPath, { recursive: true });

    memoryServer = await MongoMemoryServer.create({
      binary: {
        downloadDir: env.mongoMemoryDownloadDir
      },
      instance: {
        dbName: "bybs_lms",
        dbPath: env.mongoMemoryDbPath,
        ip: "127.0.0.1",
        port: env.mongoMemoryPort,
        storageEngine: "wiredTiger"
      }
    });

    uri = memoryServer.getUri();
    console.log("Embedded MongoDB started for local development.");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    maxPoolSize: env.mongoMaxPoolSize,
    minPoolSize: env.mongoMinPoolSize,
    serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs,
    socketTimeoutMS: env.mongoSocketTimeoutMs
  });
  console.log("MongoDB connected");
}

export async function stopDatabase() {
  await mongoose.disconnect();

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
