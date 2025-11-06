import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import { prisma } from "@rizlax/db-client";
import logger from "@rizlax/logs";
import type { User, Prisma, AuthProvider } from "@prisma/client";
import ProfileService from "./Profile.ts";

interface RegisterRequest {
  name: string;
  email: string;
  phoneNumber: string;
  country: string;
  password: string;
  role: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface OAuthNewUserParams {
  email: string;
  name: string;
  role: "CLIENT" | "FREELANCER";
  googleId: string;
  profilePicture?: string;
  authProvider: AuthProvider;
  phoneNumber?: string;
  country?: string;
}

type UserWithoutPassword = Omit<User, "password">;

type TransactionClient = Prisma.TransactionClient;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

class AuthService {
  private profileService: ProfileService;

  constructor(profileService: ProfileService) {
    this.profileService = profileService;
  }

  public async generateUserTokens(userId: string): Promise<TokenPair> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found during token generation.");
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_ACCESS_SECRET!,
      {
        algorithm: "HS256",
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
      }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_REFRESH_SECRET!,
      {
        algorithm: "HS256",
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
      }
    );

    const refreshExpiresInMs = 7 * 24 * 60 * 60 * 1000; // 7 أيام
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshExpiresInMs),
      },
    });

    return { accessToken, refreshToken };
  }

  public async register({
    name,
    email,
    phoneNumber,
    country,
    password,
    role,
  }: RegisterRequest): Promise<{
    user: UserWithoutPassword;
    accessToken: string;
    refreshToken: string;
  }> {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      logger.warn(`Registration attempt for existing user: ${email}`);
      throw new Error("User already exists");
    }

    const hashed = await argon2.hash(password);
    const normalizedRole = role.toUpperCase() as
      | "CLIENT"
      | "FREELANCER"
      | "ADMIN";

    const user = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          phoneNumber,
          country,
          password: hashed,
          role: normalizedRole,
          isVerified: false,
          authProvider: "EMAIL",
        },
      });

      await this.profileService.createInitialProfile({
        tx,
        user,
        role: normalizedRole,
      });

      return user;
    });

    const { password: _, ...userWithoutPassword } = user;

    const { accessToken, refreshToken } = await this.generateUserTokens(
      user.id
    );

    logger.info(`User registered: ${user.email}`);
    return { user: userWithoutPassword, accessToken, refreshToken };
  }

  public async login({ email, password, role }: LoginRequest & { role: "CLIENT" | "FREELANCER" }): Promise<{
    user: UserWithoutPassword;
    accessToken: string;
    refreshToken: string;
  }> {
    if (!role) {
      logger.warn(`Login attempt failed: role is missing from request body for email: ${email}`);
      throw new Error("User role (CLIENT or FREELANCER) is required for login.");
    }
    
    const user = await prisma.user.findUnique({ 
      where: { 
        email,
        role: role, 
      } 
    });

    if (!user) {
      logger.warn(`Login attempt failed: user ${email} not found or role mismatch: ${role}.`);
      throw new Error("Invalid credentials");
    }
    
    if (!user.password && user.googleId) {
      throw new Error("Please sign in using your Google account");
    }

    if (!user.password) {
      logger.warn(`Login attempt for user without local password: ${email}`);
      throw new Error("Invalid credentials");
    }

    const isValid = await argon2.verify(user.password, password);
    if (!isValid) throw new Error("Invalid credentials");

    const { accessToken, refreshToken } = await this.generateUserTokens(
      user.id
    );

    const { password: _, ...userWithoutPassword } = user;

    logger.info(`User logged in: ${user.email} with role: ${user.role}`);
    return { user: userWithoutPassword, accessToken, refreshToken };
  }

  public async logout(token: string): Promise<{ message: string }> {
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_ACCESS_SECRET!);

      logger.info(`Logout successful for User ID: ${decoded.userId}`);

      return { message: "Successfully logged out" };
    } catch (error: any) {
      logger.error("Error during token verification/logout process", {
        error: error.message,
        token: token.substring(0, 15) + "...",
      });

      throw new Error("Logout failed: Invalid or expired token provided.");
    }
  }

  public async createOAuthUserAndProfile({
    email,
    name,
    role,
    googleId,
    profilePicture,
    authProvider,
    phoneNumber,
    country,
  }: OAuthNewUserParams): Promise<User> {
    const normalizedRole = role.toUpperCase() as
      | "CLIENT"
      | "FREELANCER"
      | "ADMIN";

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          name,
          role: normalizedRole,
          isVerified: false,
          profilePicture,
          authProvider,
          googleId,
          phoneNumber: phoneNumber || "N/A_OAuth",
          country: country || "N/A_OAuth",
        },
      });

      await this.profileService.createInitialProfile({
        tx,
        user: newUser,
        role: normalizedRole,
      });

      logger.info(
        `Created new OAuth user and profile: ${newUser.email} (${normalizedRole})`
      );
      return newUser;
    });

    return user;
  }

  public async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: any;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!);
    } catch (error) {
      logger.warn("Refresh token validation failed.");
      throw new Error("Invalid or expired refresh token.");
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken) {
      logger.warn(
        `Refresh token not found in DB for user ID: ${payload.userId}`
      );
      throw new Error("Invalid refresh token.");
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      logger.error(`User not found for refresh token: ${payload.userId}`);
      throw new Error("User not found.");
    }

    const newAccessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_ACCESS_SECRET!,
      {
        algorithm: "HS256",
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
      }
    );

    logger.info(`New access token generated for user: ${user.email}`);

    return { accessToken: newAccessToken };
  }
}

export default AuthService;
