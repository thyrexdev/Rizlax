import dotenv from "dotenv";
import App from "./core/App.ts";
import { connectDB } from "@rizlax/db-client";
import logger from "@rizlax/logs";
import AuthService from "./services/Auth.ts";
import ProfileService from "./services/Profile.ts";
import OtpService from "./services/Otp.ts";
import OAuthService from "./services/OAuth.ts";
import AuthController from "./controllers/Auth.ts";
import OtpController from "./controllers/Otp.ts";
import OAuthController from "./controllers/OAuth.ts";
import createAuthRouter from "./routes/Auth.ts";
import createOAuthRouter from "./routes/OAuth.ts";
import createOtpRouter from "./routes/Otp.ts";

dotenv.config({ path: "../../.env" });

const PORT = parseInt(process.env.PORT || "3000", 10);

async function startServer() {
  try {
    console.log("Starting Auth Service dependency setup...");

    const profileService = new ProfileService();
    const otpService = new OtpService();

    const authService = new AuthService(profileService);
    const oauthService = new OAuthService(authService);

    const authController = new AuthController(authService);
    const otpController = new OtpController(otpService);
    const oauthController = new OAuthController(oauthService);

    const authRouter = createAuthRouter(authController);
    const otpRouter = createOtpRouter(otpController);
    const oauthRouter = createOAuthRouter(oauthController);

    const routers = [
      { path: "/api/auth", router: authRouter },
      { path: "/api/oauth", router: oauthRouter },
      { path: "/api/otp", router: otpRouter },
    ];

    console.log("Connecting to database...");
    await connectDB();
    console.log("Database connected successfully.");
    const server = new App(PORT, routers);

    server.listen();
  } catch (error) {
    logger.error("Auth Service failed to start:", { error });
    console.error("Auth Service failed to start:", error);
    process.exit(1);
  }
}
startServer();
