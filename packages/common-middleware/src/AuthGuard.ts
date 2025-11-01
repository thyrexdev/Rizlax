import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import logger from "logs/index.ts";

interface AuthRequest extends Request {
  userId?: string;
}

export const AuthGuard = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Authentication token missing or malformed." });
  }

    const token = authHeader.split(" ")[1];

      try {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      logger.error("JWT_ACCESS_SECRET environment variable not set.");
      return res.status(500).json({ message: "Server configuration error." });
    }

    const decoded = jwt.verify(token, secret) as { userId: string };

    req.userId = decoded.userId;

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn(`JWT verification failed: ${error.message}`, { token });
      return res.status(401).json({ message: "Invalid or expired access token." });
    }
    
    logger.error("Unexpected error during AuthGuard execution", { error });
    return res.status(500).json({ message: "Internal server error during authentication." });
  }
};
