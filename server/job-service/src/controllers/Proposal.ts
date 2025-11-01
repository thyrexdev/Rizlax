import type { Request, Response } from 'express';
import { z } from "zod";
import ProposalService from "../services/Proposal.ts"; 
import { ProposalStatus } from "@prisma/client";

const createProposalSchema = z.object({
  jobId: z.string().min(1, "Job ID is required."),
  coverLetter: z.string().min(20, "Cover letter must be at least 20 characters."),
  proposedRate: z.number().positive("Proposed rate must be a positive number.").optional(),
});

const updateProposalStatusSchema = z.object({
  status: z.nativeEnum(ProposalStatus, {
    message: "Invalid proposal status. Must be one of PENDING, INTERVIEWING, ACCEPTED, or DECLINED.",
  }),
});

const proposalFiltersSchema = z.object({
  jobId: z.string().optional(),
  status: z.nativeEnum(ProposalStatus).optional(),
  page: z.string().optional().transform(v => v ? parseInt(v) : 1),
  limit: z.string().optional().transform(v => v ? parseInt(v) : 10),
});

interface AuthGuardRequest extends Request {
  userId?: string;
}

/**
 * @class ProposalController
 * يتحكم في منطق معالجة الطلبات الواردة إلى مسارات العروض (Proposals).
 */
export class ProposalController {
  private service: ProposalService;

  constructor(proposalServiceInstance: ProposalService) {
    this.service = proposalServiceInstance;
  }

  /**
   * دالة خاصة لمعالجة الأخطاء وتحديد الـ Status Code المناسب.
   */
  private handleControllerError(res: Response, error: any): void {
    if (error instanceof z.ZodError) {
      // خطأ التحقق من البيانات
      res.status(400).json({ error: "Validation failed", details: error.issues });
      return;
    }
    
    let status = 400;
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes("not found") || errorMessage.includes("access denied") || errorMessage.includes("not authorized") || errorMessage.includes("not available")) {
        status = 404;
    } else if (errorMessage.includes("forbidden") || errorMessage.includes("permission")) {
        status = 403; 
    } else if (errorMessage.includes("already exists")) {
        status = 409; 
    }

    res.status(status).json({ error: error.message });
  }

  // --- 1. إنشاء عرض جديد (Create Proposal) ---
  public async createProposal(req: AuthGuardRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!; 

      const validatedData = createProposalSchema.parse(req.body);

      const proposalPayload = {
          ...validatedData,
          freelancerId: userId,
      };

      const proposal = await this.service.createProposal(userId, proposalPayload as any);
      res.status(201).json({ message: "Proposal submitted successfully", proposal });
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  // --- 2. جلب تفاصيل عرض محدد (Get Proposal By ID) ---
  public async getProposalById(req: AuthGuardRequest, res: Response): Promise<void> {
    try {
      const proposalId = req.params.proposalId;
      const userId = req.userId!; 

      if (!proposalId) throw new Error("Proposal ID is required.");

      const proposal = await this.service.getProposalById(proposalId, userId); 
      res.status(200).json({ proposal });
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  // --- 3. تحديث حالة العرض (Update Proposal Status) - للعميل فقط ---
  public async updateProposalStatus(req: AuthGuardRequest, res: Response): Promise<void> {
    try {
      const proposalId = req.params.proposalId;
      const userId = req.userId!;
      
      const { status } = updateProposalStatusSchema.parse(req.body);

      if (!proposalId) throw new Error("Proposal ID is required.");

      const updatedProposal = await this.service.updateProposalStatus(proposalId, userId, status);
      res.status(200).json({ message: "Proposal status updated successfully", proposal: updatedProposal });
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  // --- 4. جلب قائمة العروض (Get Proposals) - للمستقل والعميل ---
  public async getProposals(req: AuthGuardRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!; 

      const filters = proposalFiltersSchema.parse(req.query);
      
      const data = await this.service.getProposals(userId, filters as any); 
      
      res.status(200).json(data); 
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  // --- 5. حذف عرض (Delete Proposal) - للمستقل فقط ---
  public async deleteProposal(req: AuthGuardRequest, res: Response): Promise<void> {
    try {
      const proposalId = req.params.proposalId;
      const userId = req.userId!;

      if (!proposalId) throw new Error("Proposal ID is required for deletion.");

      const response = await this.service.deleteProposal(proposalId, userId);
      res.status(200).json(response);
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  // --- 6. جلب عروض وظيفة معينة (By Job ID) - للعميل فقط ---
  public async getProposalsByJobId(req: AuthGuardRequest, res: Response): Promise<void> {
    try {
      const jobId = req.params.jobId;
      const userId = req.userId!;
      
      if (!jobId) throw new Error("Job ID is required.");

      const proposals = await this.service.getProposalsByJobId(jobId, userId);
      res.status(200).json({ proposals });
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }

  // --- 7. جلب عروض مستقل معين (By Freelancer ID) - للمستقل فقط ---
  public async getFreelancerProposals(req: AuthGuardRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      
      const proposals = await this.service.getProposalsByFreelancerId(userId);

      res.status(200).json({ proposals });
    } catch (error) {
      this.handleControllerError(res, error);
    }
  }
}

export default ProposalController;
