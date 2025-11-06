import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { verifyToken } from "@rizlax/common-middleware";
import logger from "@rizlax/logs";
import { redis } from "@rizlax/redis"

interface SocketServerOptions {
  port: number;
  httpServer?: HttpServer;
}

class SocketServer {
  private io: SocketIOServer;
  private port: number;
  private hasHttpServer: boolean;

  constructor(options: SocketServerOptions) {
    this.port = options.port;
    this.hasHttpServer = !!options.httpServer;

    this.io = new SocketIOServer(options.httpServer ?? undefined, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    this.initializeMiddlewares();
    this.initializeEvents();
  }

  private initializeMiddlewares() {
    this.io.use(async (socket, next) => {
      const token = socket.handshake.auth?.token;
      try {
        const decoded = await verifyToken(token);
        console.log("✅ Decoded payload:", decoded);
        socket.data.user = decoded;
        next();
      } catch (error) {
        console.error("❌ JWT verification failed:", error);
        next(new Error("Authentication error"));
      }
    });
  }

  private initializeEvents() {
    this.io.on("connection", async (socket: Socket) => {
      const userId = socket.data.user?.userId;

      if (!userId) return;

      try {
        const client = redis.getClient();
        await client.set(`presence:${userId}`, "online");
        logger.info(`User connected: socketID ${socket.id} for user ${userId}`);
        
        socket.on("disconnect", async () => {
          try {
            // let's also set last seen time here
            await client.set(`presence:${userId}`, JSON.stringify({ status: "offline", lastSeen: new Date() }));
            logger.info(`User disconnected: ${socket.id}`);
          } catch (error) {
            logger.error(`Failed to set user offline in Redis: ${error}`);
          }
        });
      } catch (error) {
        logger.error(`Failed to set user online in Redis: ${error}`);
      }
    });
  }

  public listen() {
    if (!this.hasHttpServer) {
      this.io.listen(this.port);
      logger.info(`Socket Server is running on port ${this.port}`);
    } else {
      logger.info(`Socket Server is attached to existing HTTP server`);
    }
  }
}

export default SocketServer;
