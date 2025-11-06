import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });
import { redis } from "@rizlax/redis";
import APIServer from "./servers/api.server.ts";
import SocketServer from "./servers/socket.server.ts";
import logger from "@rizlax/logs";
import PresenceService from "./services/presence.service.ts";
import PresenceController from "./controllers/presence.controller.ts";
import createPresenceRouter from "./routes/presence.routes.ts";

const API_PORT = Number(process.env.PORT) || 5002;
const SOCKET_PORT = Number(process.env.SOCKET_PORT) || 5003;

async function startServers() {
  try {
    await redis.connect();

    const presenceService = new PresenceService();
    const presenceController = new PresenceController(presenceService);

    const presenceRouter = createPresenceRouter(presenceController);

    const routers = [{ path: "/api/presence", router: presenceRouter }];

    const apiServer = new APIServer(API_PORT, routers);
    await apiServer.listen();

    const socketServer = new SocketServer({ port: SOCKET_PORT });

    socketServer.listen();

    logger.info(`🚀 Presence Service is running on port ${API_PORT}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to start servers: ${message}`);
    process.exit(1);
  }
}

startServers();
