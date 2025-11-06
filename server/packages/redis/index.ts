import { createClient } from "redis";
import type { RedisClientType } from "redis";
import logger from "@rizlax/logs";
import { DomainError } from "@rizlax/common-middleware";

class RedisWrapper {
  private static instance: RedisWrapper | null = null;
  private readonly client: RedisClientType;
  private isConnected = false;

  private constructor() {
    const host = process.env.REDIS_HOST || "localhost";
    const port = process.env.REDIS_PORT || "6379";
    const password = process.env.REDIS_PASSWORD;

    this.client = createClient({
      url: `redis://${host}:${port}`,
      password: password || undefined,
      socket: { reconnectStrategy: (retries) => Math.min(retries * 50, 2000) },
    });

    this.registerEventListeners();
  }

  /** Ensures only one instance exists globally */
  static getInstance(): RedisWrapper {
    if (!this.instance) this.instance = new RedisWrapper();
    return this.instance;
  }

  /** Connects to Redis (idempotent) */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.debug("Redis already connected, skipping reconnection");
      return;
    }

    try {
      await this.client.connect();
      this.isConnected = true;
      logger.info("🧠 Redis connection established successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to connect to Redis: ${message}`);
      throw new DomainError("REDIS_CONNECTION_ERROR", message);
    }
  }

  /** Returns active Redis client, throws if not connected */
  getClient(): RedisClientType {
    if (!this.isConnected) {
      throw new DomainError("REDIS_NOT_CONNECTED", "Redis client not connected yet");
    }
    return this.client;
  }

  /** Gracefully disconnects the Redis client */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      logger.debug("Redis not connected, skipping disconnect");
      return;
    }

    try {
      await Promise.race([
        this.client.quit(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Redis disconnect timeout")), 5000),
        ),
      ]);
      this.isConnected = false;
      logger.info("🧠 Redis disconnected successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Redis disconnect error: ${message}`);
      this.client.disconnect();
      this.isConnected = false;
    }
  }

  /** Attaches internal event listeners for logging */
  private registerEventListeners(): void {
    this.client.on("ready", () => {
      this.isConnected = true;
      logger.info("🧠 Redis is ready");
    });

    this.client.on("reconnecting", () => logger.warn("Redis reconnecting..."));
    this.client.on("end", () => {
      this.isConnected = false;
      logger.info("Redis connection closed");
    });
    this.client.on("error", (error) => {
      logger.error(`Redis error: ${error.message}`);
    });
  }
}

export const redis = RedisWrapper.getInstance();
