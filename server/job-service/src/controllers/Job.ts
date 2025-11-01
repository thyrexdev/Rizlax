import type { Request, Response } from 'express';
import { z } from "zod";
import { JobService } from "../services/Job.ts"; 
import {
  createJobSchema,
  updateJobSchema,
  updateJobStatusSchema,
  jobFiltersSchema,
  browseJobsFiltersSchema,
} from "../validators/Job.ts";

interface AuthGuardRequest extends Request {
  userId?: string;
}

class JobController {
  private service: JobService;

  constructor(jobServiceInstance: JobService) {
    this.service = jobServiceInstance;
  }

  private handleControllerError(res: Response, error: any): void {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    
    let status = 400;
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes("not found") || errorMessage.includes("access denied") || errorMessage.includes("not authorized") || errorMessage.includes("not available")) {
        status = 404;
    }

    res.status(status).json({ error: error.message });
  }

  public async createJob(req: AuthGuardRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!; 

      const body = req.body;
      const validatedData = createJobSchema.parse(body);

      const job = await this.service.createJob(userId, validatedData);
      res.status(201).json({ message: "Job created successfully", job });
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  public async getClientJobs(req: AuthGuardRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!; 

      const query = req.query; 
      const validatedFilters = jobFiltersSchema.parse(query);

      const jobs = await this.service.getClientJobs(userId, validatedFilters);
      res.status(200).json(jobs);
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  public async getJobById(req: AuthGuardRequest, res: Response): Promise<void> {
    try {
      const jobId = req.params.jobId;
      const userId = req.userId!; 

      const job = await this.service.getJobById(jobId, userId); 
      res.status(200).json({ job });
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  public async updateJob(req: AuthGuardRequest, res: Response): Promise<void> {
    try {
      const jobId = req.params.jobId;
      const userId = req.userId!;

      const body = req.body;
      const validatedData = updateJobSchema.parse(body);

      const job = await this.service.updateJob(jobId, userId, validatedData);
      res.status(200).json({ message: "Job updated successfully", job });
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  public async deleteJob(req: AuthGuardRequest, res: Response): Promise<void> {
    try {
      const jobId = req.params.jobId;
      const userId = req.userId!;

      const response = await this.service.deleteJob(jobId, userId);
      res.status(200).json(response);
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  public async getJobStats(req: AuthGuardRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;

      const stats = await this.service.getJobStats(userId);
      res.status(200).json({ stats });
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  public async getJobProposals(req: AuthGuardRequest, res: Response): Promise<void> {
    try {
      const jobId = req.params.jobId;
      const userId = req.userId!;

      const query = req.query;
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 10);

      const proposals = await this.service.getJobProposals(jobId, userId, { page, limit });
      res.status(200).json(proposals);
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  public async updateJobStatus(req: AuthGuardRequest, res: Response): Promise<void> {
    try {
      const jobId = req.params.jobId;
      const userId = req.userId!;
      
      const body = req.body;
      const { status } = updateJobStatusSchema.parse(body);

      const job = await this.service.updateJobStatus(jobId, userId, status);
      res.status(200).json({ message: "Job status updated successfully", job });
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  public async browseJobs(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query;
      const filters = browseJobsFiltersSchema.parse(query);

      const jobs = await this.service.browseJobs(filters);
      res.status(200).json(jobs);
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  public async getJobMarketStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.service.getJobMarketStats();
      res.status(200).json({ stats });
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  public async getJobByIdPublic(req: Request, res: Response): Promise<void> {
    try {
      const jobId = req.params.jobId;
      const job = await this.service.getJobByIdPublic(jobId);
      res.status(200).json({ job });
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  public async getFeaturedJobs(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query;
      const limitNumber = query.limit ? parseInt(query.limit as string) : 6;

      const jobs = await this.service.getFeaturedJobs(limitNumber);
      res.status(200).json({ jobs });
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }
}

export default JobController;
