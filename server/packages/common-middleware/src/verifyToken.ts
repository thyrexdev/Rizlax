import jwt from "jsonwebtoken";
import { DomainError } from "./DomainError.ts";

export interface TokenPayload {
  userId: string;
  iat: number;
  exp: number;
}

export const verifyToken = async (token: string): Promise<TokenPayload> => {
  const secretKey = process.env.JWT_ACCESS_SECRET || "default_secret_key";
  try {
    const decoded = jwt.verify(token, secretKey) as TokenPayload;
    return decoded;
  } catch (error) {
    throw new DomainError("Invalid or expired token", "INVALID_TOKEN", 401);
  }
};
