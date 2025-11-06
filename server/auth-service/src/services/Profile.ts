import { prisma } from "@rizlax/db-client";
import logger from "@rizlax/logs";
import type { User, Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

interface CreateProfileParams {
  role: "CLIENT" | "FREELANCER" | "ADMIN";
  user: User;
  tx: TransactionClient;
}

class ProfileService {

    public async createInitialProfile({ role, user, tx }: CreateProfileParams): Promise<void> {
        if (role === "CLIENT") {
            await tx.client.create({
                data: {
                    userId: user.id,
                    fullName: user.name,
                },
            });
            logger.info(`Created Client profile for: ${user.email}`);
        } else if (role === "FREELANCER") {
            await tx.freelancer.create({
                data: {
                    userId: user.id,
                    fullName: user.name,
                    experienceLevel: "JUNIOR",
                },
            });
            logger.info(`Created Freelancer profile for: ${user.email}`);
        }
    }
}

export default ProfileService;
