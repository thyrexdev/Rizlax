import { prisma } from "db-client/index.ts";
import type {
  Client,
  Job,
  JobStatus,
  Freelancer,
  Skill,
  PortfolioLink,
  ExperienceLevel
} from "@prisma/client";
import logger from "logs/index.ts";

export interface UpdateProfileData {
  name?: string;
  avatar?: string;
  bio?: string;
  company?: string;
  website?: string;
  location?: string;
  phone?: string;
}

export interface ClientStats {
  totalJobs: number;
  totalSpent: number;
}

interface UpdateProfileDataFreelancer {
  bio?: string;
  hourlyRate?: number;
  experienceLevel?: ExperienceLevel;
}

interface PublicFreelancerProfile {
  fullName: string;
  bio: string | null;
  hourlyRate: number | null;
  experienceLevel: string | null;
  skills: string[];
  portfolioLinks: Array<{
    title: string;
    description: string;
    imageUrls: string[];
    liveUrl: string;
  }>;
  contractsCount: number;
  reviewsCount: number;
}

interface CreatePortfolioProjectInput {
  title: string;
  description?: string;
  imageUrls?: string[];
  githubUrl?: string;
  liveUrl?: string;
}

interface UpdatePortfolioProjectInput {
  title?: string;
  description?: string;
  imageUrls?: string[];
  githubUrl?: string;
  liveUrl?: string;
}

interface UpdateSkillsData {
  skills: string[];
}

type FreelancerWithSkills = Freelancer & {
  skills: Skill[];
};

class ProfileService {
  constructor() {
    // يمكن هنا حقن خدمات أخرى إذا لزم الأمر
  }

  // =========================================================================
  //                  COMMON UTILITIES (وظائف مساعدة مشتركة)
  // =========================================================================

  private async verifyUserAndRole(
    userId: string,
    requiredRole: "CLIENT" | "FREELANCER"
  ) {
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

  public async getClientByUserId(userId: string): Promise<Client> {
    const user = await this.verifyUserAndRole(userId, "CLIENT");

    return user.Client as Client;
  }

  public async getClientJobs(userId: string): Promise<Job[]> {
    const user = await this.verifyUserAndRole(userId, "CLIENT");
    const clientId = (user.Client as Client).id;

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

  public async updateClientProfile(
    userId: string,
    updateData: UpdateProfileData
  ): Promise<Client> {
    const user = await this.verifyUserAndRole(userId, "CLIENT");
    const clientId = (user.Client as Client).id;

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

  public async getClientStats(userId: string): Promise<ClientStats> {
    const user = await this.verifyUserAndRole(userId, "CLIENT");
    const clientId = (user.Client as Client).id;

    const [totalJobs, totalSpentResult] = await Promise.all([
      prisma.job.count({
        where: { clientId },
      }),
      prisma.job.aggregate({
        where: {
          clientId,
          status: "COMPLETED" as JobStatus,
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

  public async getFreelancerByUserId(userId: string): Promise<Freelancer> {
    const user = await this.verifyUserAndRole(userId, "FREELANCER");
    return user.Freelancer as Freelancer;
  }

  public async updateFreelancerProfile(
    userId: string,
    updateData: UpdateProfileDataFreelancer
  ): Promise<Freelancer> {
    const user = await this.verifyUserAndRole(userId, "FREELANCER");
    const freelancerId = (user.Freelancer as Freelancer).id;

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

  public async getPublicFreelancerProfile(
    userId: string
  ): Promise<PublicFreelancerProfile> {
    const user = await this.verifyUserAndRole(userId, "FREELANCER");
    const freelancerId = (user.Freelancer as Freelancer).id;

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

    if (!profile) throw new Error("Freelancer record missing in database");
    return {
      fullName: profile.user.name,
      bio: profile.bio,
      hourlyRate: profile.hourlyRate,
      experienceLevel: profile.experienceLevel,
      skills: profile.skills.map((skill: Skill) => skill.name),
      portfolioLinks: profile.portfolioLinks.map((link: PortfolioLink) => ({
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
  public async updateSkills(
    userId: string,
    updateData: UpdateSkillsData
  ): Promise<FreelancerWithSkills> {
    const user = await this.verifyUserAndRole(userId, "FREELANCER");
    const freelancerId = (user.Freelancer as Freelancer).id;

    const existingSkills = await prisma.skill.findMany({
      where: {
        name: { in: updateData.skills },
      },
    });

    const existingNames = existingSkills.map((skill) => skill.name);
    const newSkillNames = updateData.skills.filter(
      (name) => !existingNames.includes(name)
    );

    const newSkills = await Promise.all(
      newSkillNames.map((name) => prisma.skill.create({ data: { name } }))
    );

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
    return updatedSkills as FreelancerWithSkills;
  }

  // =========================================================================
  //                       PORTFOLIO LOGIC (منطق معرض الأعمال)
  // =========================================================================
  public async createProject(
    userId: string,
    data: CreatePortfolioProjectInput
  ): Promise<PortfolioLink> {
    const user = await this.verifyUserAndRole(userId, "FREELANCER");
    const freelancerId = (user.Freelancer as Freelancer).id;

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

  public async updateProject(
    userId: string,
    projectId: string,
    data: UpdatePortfolioProjectInput
  ): Promise<PortfolioLink> {
    const user = await this.verifyUserAndRole(userId, "FREELANCER");
    const freelancerId = (user.Freelancer as Freelancer).id;

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

    logger.info(
      `Portfolio project updated: ${projectId} by freelancer ${userId}`
    );
    return updatedProject;
  }

  public async deleteProject(
    userId: string,
    projectId: string
  ): Promise<{ message: string }> {
    const user = await this.verifyUserAndRole(userId, "FREELANCER");
    const freelancerId = (user.Freelancer as Freelancer).id;

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

    logger.info(
      `Portfolio project deleted: ${projectId} by freelancer ${userId}`
    );
    return { message: "Portfolio project deleted successfully" };
  }
}

export default ProfileService;
