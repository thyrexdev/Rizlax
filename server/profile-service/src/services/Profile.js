import { prisma } from "db-client/index.ts";
import logger from "logs/index.ts";
class ProfileService {
    constructor() {
        // يمكن هنا حقن خدمات أخرى إذا لزم الأمر
    }
    // =========================================================================
    //                  COMMON UTILITIES (وظائف مساعدة مشتركة)
    // =========================================================================
    async verifyUserAndRole(userId, requiredRole) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                Client: requiredRole === "CLIENT",
                Freelancer: requiredRole === "FREELANCER",
            },
        });
        if (!user || user.role !== requiredRole) {
            logger.error(`${requiredRole} profile not found or role mismatch for user ID: ${userId}`);
            throw new Error(`${requiredRole} profile not found or access denied`);
        }
        // (Fix 1) التحقق الصريح من وجود الملف الشخصي لتجنب خطأ الوصول الديناميكي
        if (requiredRole === "CLIENT" && !user.Client) {
            logger.error(`Client profile missing for user ID: ${userId}`);
            throw new Error(`${requiredRole} profile not found or access denied`);
        }
        if (requiredRole === "FREELANCER" && !user.Freelancer) {
            logger.error(`Freelancer profile missing for user ID: ${userId}`);
            throw new Error(`${requiredRole} profile not found or access denied`);
        }
        return user;
    }
    // =========================================================================
    //                         CLIENT LOGIC (منطق العميل)
    // =========================================================================
    async getClientByUserId(userId) {
        const user = await this.verifyUserAndRole(userId, "CLIENT");
        return user.Client;
    }
    async getClientJobs(userId) {
        const user = await this.verifyUserAndRole(userId, "CLIENT");
        const clientId = user.Client.id;
        const client = await prisma.client.findUnique({
            where: {
                id: clientId,
            },
            include: {
                jobs: {
                    orderBy: {
                        createdAt: "desc",
                    },
                },
            },
        });
        if (!client) {
            throw new Error("Client record missing in database");
        }
        return client.jobs;
    }
    async updateClientProfile(userId, updateData) {
        const user = await this.verifyUserAndRole(userId, "CLIENT");
        const clientId = user.Client.id;
        const updatedClient = await prisma.client.update({
            where: { id: clientId },
            data: {
                fullName: updateData.name,
                bio: updateData.bio,
                companyName: updateData.company,
                website: updateData.website,
                location: updateData.location,
            },
        });
        logger.info(`Client profile updated for user ID: ${userId}`);
        return updatedClient;
    }
    async getClientStats(userId) {
        const user = await this.verifyUserAndRole(userId, "CLIENT");
        const clientId = user.Client.id;
        const [totalJobs, totalSpentResult] = await Promise.all([
            prisma.job.count({
                where: { clientId },
            }),
            prisma.job.aggregate({
                where: {
                    clientId,
                    status: "COMPLETED",
                },
                _sum: {
                    budget: true,
                },
            }),
        ]);
        return {
            totalJobs,
            totalSpent: totalSpentResult._sum.budget || 0,
        };
    }
    // =========================================================================
    //                       FREELANCER LOGIC (منطق المستقل)
    // =========================================================================
    async getFreelancerByUserId(userId) {
        const user = await this.verifyUserAndRole(userId, "FREELANCER");
        return user.Freelancer;
    }
    async updateFreelancerProfile(userId, updateData) {
        const user = await this.verifyUserAndRole(userId, "FREELANCER");
        const freelancerId = user.Freelancer.id;
        const updatedProfile = await prisma.freelancer.update({
            where: { id: freelancerId },
            data: {
                bio: updateData.bio,
                hourlyRate: updateData.hourlyRate,
                experienceLevel: updateData.experienceLevel,
            },
        });
        logger.info(`Freelancer profile updated for user ID: ${userId}`);
        return updatedProfile;
    }
    async getPublicFreelancerProfile(userId) {
        const user = await this.verifyUserAndRole(userId, "FREELANCER");
        const freelancerId = user.Freelancer.id;
        const profile = await prisma.freelancer.findUnique({
            where: { id: freelancerId },
            include: {
                skills: true,
                portfolioLinks: true,
                user: { select: { name: true } },
                _count: {
                    select: { contracts: true, reviews: true },
                },
            },
        });
        if (!profile)
            throw new Error("Freelancer record missing in database");
        return {
            fullName: profile.user.name,
            bio: profile.bio,
            hourlyRate: profile.hourlyRate,
            experienceLevel: profile.experienceLevel,
            skills: profile.skills.map((skill) => skill.name),
            portfolioLinks: profile.portfolioLinks.map((link) => ({
                title: link.title,
                description: link.description || "",
                imageUrls: link.imageUrls || [],
                liveUrl: link.liveUrl || "",
            })),
            contractsCount: profile._count.contracts,
            reviewsCount: profile._count.reviews,
        };
    }
    // =========================================================================
    //                       SKILLS LOGIC (منطق المهارات)
    // =========================================================================
    async updateSkills(userId, updateData) {
        const user = await this.verifyUserAndRole(userId, "FREELANCER");
        const freelancerId = user.Freelancer.id;
        const existingSkills = await prisma.skill.findMany({
            where: {
                name: { in: updateData.skills },
            },
        });
        const existingNames = existingSkills.map((skill) => skill.name);
        const newSkillNames = updateData.skills.filter((name) => !existingNames.includes(name));
        const newSkills = await Promise.all(newSkillNames.map((name) => prisma.skill.create({ data: { name } })));
        const allSkills = [...existingSkills, ...newSkills];
        const updatedSkills = await prisma.freelancer.update({
            where: { id: freelancerId },
            data: {
                skills: {
                    set: allSkills.map((skill) => ({ id: skill.id })),
                },
            },
            include: {
                skills: true,
            },
        });
        logger.info(`Freelancer skills updated for user ID: ${userId}`);
        return updatedSkills;
    }
    // =========================================================================
    //                       PORTFOLIO LOGIC (منطق معرض الأعمال)
    // =========================================================================
    async createProject(userId, data) {
        const user = await this.verifyUserAndRole(userId, "FREELANCER");
        const freelancerId = user.Freelancer.id;
        const newProject = await prisma.portfolioLink.create({
            data: {
                title: data.title,
                description: data.description,
                imageUrls: data.imageUrls,
                githubUrl: data.githubUrl,
                liveUrl: data.liveUrl,
                freelancer: {
                    connect: { id: freelancerId },
                },
            },
        });
        logger.info(`New portfolio project created by freelancer ${userId}`);
        return newProject;
    }
    async updateProject(userId, projectId, data) {
        const user = await this.verifyUserAndRole(userId, "FREELANCER");
        const freelancerId = user.Freelancer.id;
        const existingProject = await prisma.portfolioLink.findFirst({
            where: {
                id: projectId,
                freelancerId: freelancerId,
            },
        });
        if (!existingProject) {
            throw new Error("Portfolio project not found or permission denied");
        }
        const updatedProject = await prisma.portfolioLink.update({
            where: { id: projectId },
            data: {
                ...(data.title && { title: data.title }),
                ...(data.description !== undefined && {
                    description: data.description,
                }),
                ...(data.imageUrls && { imageUrls: data.imageUrls }),
                ...(data.githubUrl !== undefined && { githubUrl: data.githubUrl }),
                ...(data.liveUrl !== undefined && { liveUrl: data.liveUrl }),
            },
        });
        logger.info(`Portfolio project updated: ${projectId} by freelancer ${userId}`);
        return updatedProject;
    }
    async deleteProject(userId, projectId) {
        const user = await this.verifyUserAndRole(userId, "FREELANCER");
        const freelancerId = user.Freelancer.id;
        const existingProject = await prisma.portfolioLink.findFirst({
            where: {
                id: projectId,
                freelancerId: freelancerId,
            },
        });
        if (!existingProject) {
            throw new Error("Portfolio project not found or permission denied");
        }
        await prisma.portfolioLink.delete({
            where: { id: projectId },
        });
        logger.info(`Portfolio project deleted: ${projectId} by freelancer ${userId}`);
        return { message: "Portfolio project deleted successfully" };
    }
}
export default ProfileService;
