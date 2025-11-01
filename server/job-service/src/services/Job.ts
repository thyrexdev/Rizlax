import { prisma } from "db-client/index.ts";
import { type Job, JobStatus, type Prisma } from "@prisma/client";
import type {
  CreateJobRequest,
  UpdateJobRequest,
  GetClientJobsFilters,
  GetJobProposalsFilters,
  JobStats,
  ClientJobsResponse,
  JobProposalsResponse,
  DeleteJobResponse,
  BrowseJobsFilters,
  BrowseJobsResponse,
  JobMarketStats,
  JobWithDetails
} from "../types/Job.ts";

export class JobService {

  private async _getClientId(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        Client: { select: { id: true } }
      }
    });

    if (!user) {
      throw new Error("User not found");
    }
    if (user.role !== "CLIENT") {
      throw new Error("Only clients can perform this action");
    }
    if (!user.Client) {
      throw new Error("Client profile not found");
    }

    return user.Client.id;
  }

  private async _getOwnedJob<T extends Prisma.JobInclude>(
    jobId: string, 
    clientId: string, 
    includes: T = {} as T
  ): Promise<Prisma.JobGetPayload<{ include: T }>> {
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        clientId: clientId
      },
      include: includes
    });

    if (!job) {
      throw new Error("Job not found or access denied");
    }

    return job as Prisma.JobGetPayload<{ include: T }>;
  }


  public async createJob(userId: string, jobData: CreateJobRequest): Promise<JobWithDetails> {
    const clientId = await this._getClientId(userId);

    const job = await prisma.job.create({
      data: {
        clientId: clientId,
        title: jobData.title,
        description: jobData.description,
        budget: jobData.budget,
        category: jobData.category,
        status: JobStatus.OPEN,
      },
      include: {
        client: {
          include: {
            user: {
              select: { id: true, name: true, email: true, }
            }
          }
        },
        _count: {
          select: { proposals: true }
        }
      }
    });

    return job as JobWithDetails;
  }

  public async getClientJobs(userId: string, filters: GetClientJobsFilters): Promise<ClientJobsResponse> {
    const clientId = await this._getClientId(userId);

    const { page, limit, status, category } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.JobWhereInput = {
      clientId: clientId,
    };

    if (status) { where.status = status; }
    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { include: { user: { select: { id: true, name: true, email: true, } } } },
          _count: { select: { proposals: true } }
        }
      }) as Promise<JobWithDetails[]>,
      prisma.job.count({ where })
    ]);


    return {
      jobs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }

  public async getJobById(jobId: string, userId: string): Promise<Job> {
    const clientId = await this._getClientId(userId);

    const job = await this._getOwnedJob(jobId, clientId, {
        client: {
          include: { user: { select: { id: true, name: true, email: true } } }
        },
        proposals: {
          include: {
            freelancer: {
              include: {
                user: { select: { id: true, name: true, email: true } },
                skills: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: { select: { proposals: true } }
    });

    return job as Job;
  }

  public async updateJob(jobId: string, userId: string, updateData: UpdateJobRequest): Promise<JobWithDetails> {
    const clientId = await this._getClientId(userId);

    const existingJob = await this._getOwnedJob(jobId, clientId, {});

    if (existingJob.status === JobStatus.COMPLETED || existingJob.status === JobStatus.CANCELED) {
      throw new Error("Cannot update completed or canceled jobs");
    }

    const job = await prisma.job.update({
      where: { id: jobId },
      data: updateData,
      include: {
        client: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { proposals: true } }
      }
    });

    return job as JobWithDetails;
  }

  public async deleteJob(jobId: string, userId: string): Promise<DeleteJobResponse> {
    const clientId = await this._getClientId(userId);

    const existingJob = await this._getOwnedJob(jobId, clientId, { contract: true });

    if (existingJob.contract || existingJob.status === JobStatus.IN_PROGRESS) {
      throw new Error("Cannot delete jobs with active contracts or in progress");
    }

    await prisma.job.delete({
      where: { id: jobId }
    });

    return { message: "Job deleted successfully" };
  }

  public async getJobStats(userId: string): Promise<JobStats> {
    const clientId = await this._getClientId(userId);

    const [
      totalJobs,
      activeJobs,
      completedJobs,
      inProgressJobs,
      totalProposals,
      totalSpent
    ] = await Promise.all([
      prisma.job.count({ where: { clientId: clientId } }),
      prisma.job.count({ where: { clientId: clientId, status: JobStatus.OPEN } }),
      prisma.job.count({ where: { clientId: clientId, status: JobStatus.COMPLETED } }),
      prisma.job.count({ where: { clientId: clientId, status: JobStatus.IN_PROGRESS } }),
      prisma.proposal.count({
        where: { job: { clientId: clientId } }
      }),
      prisma.job.aggregate({
        where: { clientId: clientId, status: JobStatus.COMPLETED },
        _sum: { budget: true }
      })
    ]);

    const totalSpentValue = totalSpent._sum.budget || 0;
    const canceledJobs = totalJobs - activeJobs - completedJobs - inProgressJobs;

    return {
      totalJobs,
      activeJobs,
      completedJobs,
      inProgressJobs,
      canceledJobs: canceledJobs < 0 ? 0 : canceledJobs,
      totalProposals,
      totalSpent: totalSpentValue,
      averageBudget: completedJobs > 0 ? totalSpentValue / completedJobs : 0
    };
  }

  public async getJobProposals(jobId: string, userId: string, filters: GetJobProposalsFilters): Promise<JobProposalsResponse> {
    const clientId = await this._getClientId(userId);

    const job = await this._getOwnedJob(jobId, clientId, {});

    const { page, limit } = filters;
    const skip = (page - 1) * limit;

    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({
        where: { jobId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          freelancer: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              skills: true,
              _count: { select: { contracts: true, reviews: true } }
            }
          }
        }
      }) as Promise<any[]>,
      prisma.proposal.count({ where: { jobId } })
    ]);

    return {
      proposals,
      pagination: {
        page, limit, total, pages: Math.ceil(total / limit)
      }
    };
  }

  public async updateJobStatus(jobId: string, userId: string, status: JobStatus): Promise<JobWithDetails> {
    const clientId = await this._getClientId(userId);

    const existingJob = await this._getOwnedJob(jobId, clientId, {});

    const job = await prisma.job.update({
      where: { id: jobId },
      data: { status },
      include: {
        client: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { proposals: true } }
      }
    });

    return job as JobWithDetails;
  }

  public async browseJobs(filters: BrowseJobsFilters): Promise<BrowseJobsResponse> {
    const { page, limit, category, minBudget, maxBudget, status, search } = filters
    const skip = (page - 1) * limit

    const where: Prisma.JobWhereInput = {}

    where.status = status || JobStatus.OPEN

    if (category) {
      where.category = { contains: category, mode: "insensitive" }
    }

    if (minBudget || maxBudget) {
      where.budget = {}
      if (minBudget) where.budget.gte = minBudget
      if (maxBudget) where.budget.lte = maxBudget
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: {
            select: {
              id: true,
              fullName: true,
              companyName: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
          _count: { select: { proposals: true } },
        },
      }) as Promise<JobWithDetails[]>,
      prisma.job.count({ where }),
    ])

    const response: BrowseJobsResponse = {
      jobs,
      pagination: {
        page, limit, total, pages: Math.ceil(total / limit),
      },
    }

    return response
  }

  public async getJobMarketStats(): Promise<JobMarketStats> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [
      totalOpenJobs,
      totalJobsThisWeek,
      averageBudgetData,
      topCategoriesData
    ] = await Promise.all([
      prisma.job.count({ where: { status: JobStatus.OPEN } }),
      prisma.job.count({
        where: { createdAt: { gte: oneWeekAgo } }
      }),
      prisma.job.aggregate({
        where: { status: JobStatus.OPEN },
        _avg: { budget: true }
      }),
      prisma.job.groupBy({
        by: ['category'],
        where: { status: JobStatus.OPEN },
        _count: { category: true },
        orderBy: { _count: { category: 'desc' } },
        take: 5
      })
    ]);

    const topCategories = topCategoriesData.map((item) => ({
      category: item.category,
      count: item._count.category
    }));

    const stats: JobMarketStats = {
      totalOpenJobs,
      totalJobsThisWeek,
      averageBudget: averageBudgetData._avg.budget || 0,
      topCategories
    }

    return stats;
  }

  public async getJobByIdPublic(jobId: string): Promise<JobWithDetails> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            companyName: true,
            user: { select: { id: true, name: true, email: true } }
          }
        },
        _count: { select: { proposals: true } }
      }
    });

    if (!job) {
      throw new Error("Job not found");
    }

    if (job.status !== JobStatus.OPEN) {
      throw new Error("Job is not available");
    }

    return job as JobWithDetails;
  }

  public async getFeaturedJobs(limit: number = 6): Promise<JobWithDetails[]> {
    const jobs = await prisma.job.findMany({
      where: { status: JobStatus.OPEN },
      take: limit,
      orderBy: [
        { proposals: { _count: 'desc' } },
        { createdAt: 'desc' }
      ],
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            companyName: true,
            user: { select: { id: true, name: true, email: true } }
          }
        },
        _count: { select: { proposals: true } }
      }
    });

    return jobs as JobWithDetails[];
  }
}

export default JobService;
