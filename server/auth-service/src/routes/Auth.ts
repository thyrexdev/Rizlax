import { Router } from "express";
import AuthController from "../controllers/Auth.ts";
import { AuthGuard } from "@rizlax/common-middleware";

interface IAuthController {
  register: typeof AuthController.prototype.register;
  login: typeof AuthController.prototype.login;
  refresh: typeof AuthController.prototype.refresh;
  logout: typeof AuthController.prototype.logout;
}

export default function createAuthRouter(
  authController: IAuthController
): Router {
  const router = Router();

  router.post("/register", authController.register.bind(authController));
  router.post("/login", authController.login.bind(authController));
  router.post(
    "/refresh",
    AuthGuard,
    authController.refresh.bind(authController)
  );
  router.get("/refresh", authController.refresh.bind(authController));
  router.post("/logout", authController.logout.bind(authController));

  return router;
}
