import { prisma } from "db-client/index.ts";
import logger from "logs/index.ts";
import AuthService from "./Auth.ts";
import type { User } from "@prisma/client";

interface OAuthUserProfile {
  id: string;
  email: string;
  name: string;
  profilePicture?: string;
  provider: "GOOGLE";
}

type UserWithoutPassword = Omit<User, "password">;

interface OAuthResult {
  user: UserWithoutPassword;
  accessToken: string;
  refreshToken: string;
}

interface IAuthService {
  createOAuthUserAndProfile: typeof AuthService.prototype.createOAuthUserAndProfile;
  generateUserTokens: typeof AuthService.prototype.generateUserTokens;
}

class OAuthService {
  private authService: IAuthService;

  constructor(authService: IAuthService) {
    this.authService = authService;
  }

  public async handleOAuthCallback(
    profile: OAuthUserProfile,
    role: "CLIENT" | "FREELANCER"
  ): Promise<OAuthResult> {
    try {
      const { id, email, name, profilePicture, provider } = profile;

      let user = await prisma.user.findUnique({
        where: { googleId: id },
      });

      if (user) {
        logger.info(`OAuth Login successful for existing user: ${user.email}`);
      } else {
        const existingUserByEmail = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUserByEmail) {
          // Linking existing user
          user = await prisma.user.update({
            where: { id: existingUserByEmail.id },
            data: {
              googleId: id,
              profilePicture:
                profilePicture || existingUserByEmail.profilePicture,
              authProvider: provider,
              isVerified: true,
            },
          });
          logger.info(`Linked ${provider} ID to existing user: ${user.email}`);
        } else {
          // Creating new OAuth user
          user = await this.authService.createOAuthUserAndProfile({
            email,
            name,
            role,
            googleId: id,
            profilePicture,
            authProvider: provider,
          });
        }
      }

      const { password: _, ...userWithoutPassword } = user;

      const { accessToken, refreshToken } =
        await this.authService.generateUserTokens(user.id);

      return { user: userWithoutPassword, accessToken, refreshToken };
    } catch (error: any) {
      logger.error(
        `Error during OAuth handling for email ${profile.email}: ${error.message}`
      );
      throw new Error(
        "Authentication failed with external provider. Please try again."
      );
    }
  }

  public async unlinkGoogleProvider(
    userId: string
  ): Promise<UserWithoutPassword> {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      logger.warn(
        `Attempted to unlink Google for non-existent user ID: ${userId}`
      );
      throw new Error("User not found.");
    }

    if (user.authProvider === "GOOGLE" && !user.password) {
      throw new Error(
        "Cannot unlink Google account without setting a local password first."
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        googleId: null,
        profilePicture: null,
        authProvider: user.password ? "EMAIL" : user.authProvider,
      },
    });

    const { password: _, ...userWithoutPassword } = updatedUser;
    logger.info(`Google provider unlinked successfully for user: ${userId}`);
    return userWithoutPassword;
  }
}

export default OAuthService;
