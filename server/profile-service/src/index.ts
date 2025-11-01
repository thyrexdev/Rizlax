import dotenv from "dotenv";
import App from "./core/App.ts";
import { connectDB } from "db-client/index.ts";
import logger from "logs/index.ts";

import ProfileService from "./services/Profile.ts";

import ProfileController from "./controllers/Profile.ts";

import createProfileRouter from "./routes/Profile.ts";

dotenv.config({ path: "../../.env" });

const PORT = parseInt(process.env.PROFILE_PORT || "3001", 10);

async function startServer() {
  try {
    console.log("Starting Profile Service dependency setup...");

    const profileService = new ProfileService();

    const profileController = new ProfileController(profileService);

    const profileRouter = createProfileRouter(profileController);

    const routers = [{ path: "/api/profile", router: profileRouter }];

    console.log("Connecting to database...");
    await connectDB();
    console.log("Database connected successfully.");

    const server = new App(PORT, routers);

    await server.listen();
  } catch (error) {
    logger.error("Profile Service failed to start:", { error });
    console.error("Profile Service failed to start:", error);
    process.exit(1);
  }
}

startServer();
