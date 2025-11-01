import { prisma } from "db-client/index.ts"; 
import type { Proposal as PrismaProposalModel, ProposalStatus as ProposalStatusType, Freelancer, Client, Job } from "@prisma/client"
import { ProposalStatus } from "@prisma/client" 

import logger from "logs/index.ts";

import type { CreateProposalData, GetProposalsFilters, ProposalWithDetails } from "../types/Proposal.ts"; 

type Proposal = PrismaProposalModel;

/**
 * ProposalService: مسؤولة عن جميع العمليات المتعلقة بعروض المستقلين (Proposals)
 * من إنشاء، جلب، وتحديث حالة العرض.
 */
class ProposalService {
  
  // --- الدوال الخاصة (Private Helper Methods) ---

  /**
   * يتحقق من وجود المستخدم ودوره كمستقل ويعيد كائن Freelancer.
   * @param userId - معرف المستخدم.
   * @throws Error إذا لم يكن المستخدم مستقلاً صالحاً.
   */
  private async _getFreelancerProfile(userId: string): Promise<Freelancer> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { Freelancer: true }
    });

    if (!user || user.role !== "FREELANCER" || !user.Freelancer) {
      logger.warn(`User ${userId} attempted an action requiring FREELANCER role but failed.`);
      throw new Error("Only freelancers can perform this action");
    }
    return user.Freelancer;
  }

  /**
   * يتحقق من وجود المستخدم ودوره كعميل ويعيد كائن Client.
   * @param userId - معرف المستخدم.
   * @throws Error إذا لم يكن المستخدم عميلاً صالحاً.
   */
  private async _getClientProfile(userId: string): Promise<Client> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { Client: true }
    });

    if (!user || user.role !== "CLIENT" || !user.Client) {
      logger.warn(`User ${userId} attempted an action requiring CLIENT role but failed.`);
      throw new Error("Only clients can perform this action");
    }
    return user.Client;
  }

  /**
   * يتحقق من وجود الوظيفة وأن حالتها OPEN.
   * @param jobId - معرف الوظيفة.
   * @throws Error إذا لم يتم العثور على الوظيفة أو أنها ليست مفتوحة.
   */
  private async _checkJobOpen(jobId: string): Promise<Job> {
    const job = await prisma.job.findUnique({
      where: { id: jobId }
    });

    if (!job) {
      logger.warn(`Job ${jobId} not found.`);
      throw new Error("Job not found");
    }

    if (job.status !== "OPEN") {
      logger.warn(`Job ${jobId} is not open (Status: ${job.status}).`);
      throw new Error("Job is not open for proposals");
    }
    return job;
  }

  // --- الدوال العامة (Public Methods) ---

  /**
   * ينشئ عرضاً جديداً لوظيفة معينة.
   * @param userId - معرف المستخدم.
   * @param data - بيانات العرض (coverLetter, proposedRate, jobId).
   * @returns كائن Proposal الذي تم إنشاؤه.
   */
  public async createProposal(userId: string, data: CreateProposalData): Promise<Proposal> {
    const freelancer = await this._getFreelancerProfile(userId);
    await this._checkJobOpen(data.jobId);
    
    // التحقق مما إذا كان المستقل قد قدم عرضاً مسبقاً
    const existingProposal = await prisma.proposal.findFirst({
      where: {
        freelancerId: freelancer.id,
        jobId: data.jobId
      }
    });

    if (existingProposal) {
      throw new Error("You have already submitted a proposal for this job");
    }

    const proposal = await prisma.proposal.create({
      data: {
        freelancerId: freelancer.id,
        jobId: data.jobId,
        coverLetter: data.coverLetter,
        proposedRate: data.proposedRate,
        status: ProposalStatus.PENDING 
      }
    });
    
    logger.info(`Proposal created successfully by freelancer ${userId} for job ${data.jobId}`);
    return proposal;
  }

  /**
   * جلب تفاصيل عرض معين.
   * @param id - معرف العرض.
   * @param userId - معرف المستخدم المتحقق (يجب أن يكون مالك العرض أو مالك الوظيفة).
   * @returns تفاصيل العرض الموسعة.
   */
  public async getProposalById(id: string, userId: string): Promise<ProposalWithDetails | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { Client: true, Freelancer: true }
    });

    if (!user) { throw new Error("User not found"); }

    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: {
        freelancer: {
          include: {
            user: { select: { id: true, name: true, email: true, profilePicture: true } },
            skills: { select: { id: true, name: true } } 
          }
        },
        job: {
          include: {
            client: {
              include: {
                user: { select: { id: true, name: true, email: true, profilePicture: true } }
              }
            }
          }
        }
      }
    });

    if (!proposal) {
      logger.warn(`Proposal ${id} not found.`);
      return null;
    }

    // التحقق من صلاحيات الوصول (مسموح للمستقل المالك أو العميل المالك للوظيفة)
    const isFreelancerOwner = user.Freelancer && proposal.freelancerId === user.Freelancer.id;
    const isClientOwner = user.Client && (proposal as any).job.clientId === user.Client.id;

    if (!isFreelancerOwner && !isClientOwner) {
      logger.warn(`Access denied to proposal ${id} for user ${userId}.`);
      throw new Error("Access denied");
    }

    return proposal as any as ProposalWithDetails;
  }
  
  /**
   * جلب قائمة بالعروض بناءً على دور المستخدم والفلاتر.
   * (هذه الدالة تبقى على حالها لأنها تحتاج لكلا الملفين Client و Freelancer للتحقق من الصلاحيات)
   * @param userId - معرف المستخدم.
   * @param filters - فلاتر التصفية والصفحات (jobId, status, page, limit).
   * @returns قائمة العروض وبيانات التصفح.
   */
  public async getProposals(userId: string, filters: GetProposalsFilters): Promise<{
    proposals: ProposalWithDetails[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { Client: true, Freelancer: true }
    });

    if (!user) { throw new Error("User not found"); }

    const { jobId, status, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (user.role === "CLIENT" && user.Client) {
      whereClause.job = { clientId: user.Client.id };
      if (jobId) whereClause.jobId = jobId;
    } else if (user.role === "FREELANCER" && user.Freelancer) {
      whereClause.freelancerId = user.Freelancer.id;
    } else {
      throw new Error("Invalid user role or missing profile");
    }

    if (status) whereClause.status = status;

    const [proposals, totalCount] = await Promise.all([
      prisma.proposal.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          freelancer: {
            include: {
              user: { select: { id: true, name: true, email: true, profilePicture: true } },
              skills: { select: { id: true, name: true } }
            }
          },
          job: {
            include: {
              client: {
                include: {
                  user: { select: { id: true, name: true, email: true, profilePicture: true } }
                }
              }
            }
          }
        }
      }),
      prisma.proposal.count({ where: whereClause })
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    logger.info(`Retrieved ${proposals.length} proposals for user ${userId}. Total count: ${totalCount}`);

    return {
      proposals: proposals as any as ProposalWithDetails[],
      totalCount,
      currentPage: page,
      totalPages
    };
  }

  /**
   * تحديث حالة العرض (يسمح للعميل فقط).
   * @param proposalId - معرف العرض.
   * @param userId - معرف المستخدم.
   * @param status - الحالة الجديدة.
   * @returns كائن Proposal بعد التحديث.
   */
  public async updateProposalStatus(proposalId: string, userId: string, status: ProposalStatusType): Promise<Proposal> {
    const client = await this._getClientProfile(userId);

    const existingProposal = await prisma.proposal.findFirst({
      where: {
        id: proposalId,
        job: {
          clientId: client.id
        }
      }
    });

    if (!existingProposal) {
      logger.warn(`Status update failed: Proposal ${proposalId} not found or client ${userId} has no access.`);
      throw new Error("Proposal not found or access denied");
    }
    
    if (existingProposal.status !== ProposalStatus.PENDING) {
        throw new Error("Cannot change status back to PENDING from a processed state.");
    }

    const updatedProposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: { status }
    });
    
    logger.info(`Proposal ${proposalId} status updated to ${status} by client ${userId}.`);
    return updatedProposal;
  }

  /**
   * حذف العرض (يسمح للمستقل المالك فقط).
   * @param proposalId - معرف العرض.
   * @param userId - معرف المستخدم.
   * @returns رسالة تأكيد.
   */
  public async deleteProposal(proposalId: string, userId: string): Promise<{ message: string }> {
    const freelancer = await this._getFreelancerProfile(userId);

    const existingProposal = await prisma.proposal.findFirst({
      where: {
        id: proposalId,
        freelancerId: freelancer.id
      }
    });

    if (!existingProposal) {
      logger.warn(`Delete failed: Proposal ${proposalId} not found or freelancer ${userId} has no access.`);
      throw new Error("Proposal not found or access denied");
    }

    if (existingProposal.status !== ProposalStatus.PENDING) {
      throw new Error("Cannot delete proposal that has been processed");
    }

    await prisma.proposal.delete({
      where: { id: proposalId }
    });

    logger.info(`Proposal ${proposalId} deleted successfully by freelancer ${userId}.`);
    return { message: "Proposal deleted successfully" };
  }
  
  /**
   * جلب جميع العروض لوظيفة معينة (وظيفة مساعدة للـ Controller).
   * @param jobId - معرف الوظيفة.
   * @param userId - معرف العميل المالك للوظيفة.
   * @returns قائمة العروض الموسعة.
   */
  public async getProposalsByJobId(jobId: string, userId: string): Promise<ProposalWithDetails[]> {
    const client = await this._getClientProfile(userId);

    const job = await prisma.job.findFirst({
      where: { id: jobId, clientId: client.id }
    });

    if (!job) {
      logger.warn(`Job ${jobId} not found or client ${userId} does not own it.`);
      throw new Error("Job not found or access denied");
    }

    const proposals = await prisma.proposal.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
      include: {
        freelancer: {
          include: {
            user: { select: { id: true, name: true, email: true, profilePicture: true } },
            skills: { select: { id: true, name: true } }
          }
        },
        job: true
      }
    });
    
    logger.info(`Retrieved ${proposals.length} proposals for job ${jobId}.`);
    return proposals as any as ProposalWithDetails[];
  }

  /**
   * جلب جميع العروض التي قدمها مستقل معين (وظيفة مساعدة للـ Controller).
   * @param userId - معرف المستقل.
   * @returns قائمة العروض الموسعة.
   */
  public async getProposalsByFreelancerId(userId: string): Promise<ProposalWithDetails[]> {
    const freelancer = await this._getFreelancerProfile(userId);

    const proposals = await prisma.proposal.findMany({
      where: { freelancerId: freelancer.id },
      orderBy: { createdAt: 'desc' },
      include: {
        freelancer: true,
        job: {
          include: {
            client: {
              include: {
                user: { select: { id: true, name: true, email: true, profilePicture: true } }
              }
            }
          }
        }
      }
    });

    logger.info(`Retrieved ${proposals.length} proposals for freelancer ${userId}.`);
    return proposals as any as ProposalWithDetails[];
  }
}

export default ProposalService;
