import type { Request, Response } from "express";
import z, { success } from "zod";
import DomainError from "common-middleware/src/DomainError.ts";
import type { Milestone } from "@prisma/client";
import type { MilestoneDTO } from "../types/MilestoneDTO.ts";
import logger from "logs/index.ts";

const createMilestoneSchema = z.object({
  contractId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  amount: z.number().min(10),
  dueDate: z.string().transform((d) => {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) throw new Error("Invalid date format");
    return parsed;
  }),
});

type AuthReq = Request & { userId: string };

interface IMilestoneService {
  createMilestone: (data: MilestoneDTO, userId: string) => Promise<Milestone>;
  getMilestones: (contractId: string, userId: string) => Promise<Milestone[]>;
  getMilestoneById: (milestoneId: string) => Promise<Milestone | null>;
  updateMilestone: (
    milestoneId: string,
    userId: string,
    data: Partial<MilestoneDTO>
  ) => Promise<Milestone | null>;
  markMilestoneAsApprovedByFreelancer: (
    milestoneId: string,
    userId: string
  ) => Promise<Milestone | null>;
  rejectMilestone: (
    milestoneId: string,
    userId: string
  ) => Promise<Milestone | null>;
  submitMilestone: (
    milestoneId: string,
    userId: string
  ) => Promise<Milestone | null>;
  disputeMilestone: (
    milestoneId: string,
    userId: string
  ) => Promise<Milestone | null>;
  approveWorkByClient: (
    milestoneId: string,
    userId: string
  ) => Promise<Milestone | null>;
  requestDeletion: (
    milestoneId: string,
    userId: string
  ) => Promise<Milestone | null>;
  acceptRequestDeletion: (
    milestoneId: string,
    userId: string
  ) => Promise<Milestone | null>;
}

class MilestoneController {
  private milestoneService: IMilestoneService;

  constructor(milestoneService: IMilestoneService) {
    this.milestoneService = milestoneService;
  }

  private handleError(err: unknown, req: AuthReq, res: Response) {
    if (err instanceof DomainError) {
      return res
        .status(err.statusCode)
        .json({ message: err.message, code: err.code });
    }

    if (err instanceof z.ZodError) {
      return res
        .status(400)
        .json({ message: "Invalid request data", issues: err.issues });
    }

    logger.error(`[MilestoneController] ${req.method} ${req.url}`, err);
    return res.status(500).json({ message: "Internal server error" });
  }

  public createMilestone = async (req: AuthReq, res: Response) => {
    logger.info(
      `[MilestoneController] ${req.method} ${req.url} by user ${req.userId}`
    );
    try {
      const parsedData = createMilestoneSchema.parse(req.body);
      const milestone = await this.milestoneService.createMilestone(
        {
          contractId: parsedData.contractId,
          title: parsedData.title,
          description: parsedData.description || "",
          amount: parsedData.amount,
          dueDate: parsedData.dueDate,
        },
        req.userId
      );
      return res.status(201).json(milestone);
    } catch (err) {
      return this.handleError(err, req, res);
    }
  };

  public getMilestones = async (req: AuthReq, res: Response) => {
    logger.info(
      `[MilestoneController] ${req.method} ${req.url} by user ${req.userId}`
    );
    try {
      const { contractId } = req.params;
      const milestones = await this.milestoneService.getMilestones(
        contractId,
        req.userId
      );
      return res.status(200).json(milestones);
    } catch (err) {
      return this.handleError(err, req, res);
    }
  };

  public getMilestoneById = async (req: AuthReq, res: Response) => {
    logger.info(
      `[MilestoneController] ${req.method} ${req.url} by user ${req.userId}`
    );
    try {
      const { milestoneId } = req.params;
      const milestone = await this.milestoneService.getMilestoneById(
        milestoneId
      );
      if (!milestone) {
        return res
          .status(404)
          .json({ success: false, message: "Milestone not found" });
      }
      return res.status(200).json({ success: true, data: milestone });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  };

  public updateMilestone = async (req: AuthReq, res: Response) => {
    logger.info(
      `[MilestoneController] ${req.method} ${req.url} by user ${req.userId}`
    );
    try {
      const { milestoneId } = req.params;
      const updatedMilestone = await this.milestoneService.updateMilestone(
        milestoneId,
        req.userId,
        req.body
      );
      if (!updatedMilestone) {
        return res.status(404).json({
          success: false,
          message: "Milestone not found or not updated",
        });
      }
      return res.status(200).json({ success: true, data: updatedMilestone });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  };

  public markMilestoneAsApprovedByFreelancer = async (
    req: AuthReq,
    res: Response
  ) => {
    logger.info(
      `[MilestoneController] ${req.method} ${req.url} by user ${req.userId}`
    );
    try {
      const { milestoneId } = req.params;
      const milestone =
        await this.milestoneService.markMilestoneAsApprovedByFreelancer(
          milestoneId,
          req.userId
        );
      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: "Milestone not found or not approved",
        });
      }
      return res.status(200).json({ success: true, data: milestone });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  };

  public rejectMilestone = async (req: AuthReq, res: Response) => {
    logger.info(
      `[MilestoneController] ${req.method} ${req.url} by user ${req.userId}`
    );
    try {
      const { milestoneId } = req.params;
      const milestone = await this.milestoneService.rejectMilestone(
        milestoneId,
        req.userId
      );
      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: "Milestone not found or not rejected",
        });
      }
      return res.status(200).json({ success: true, data: milestone });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  };

  public submitMilestone = async (req: AuthReq, res: Response) => {
    logger.info(
      `[MilestoneController] ${req.method} ${req.url} by user ${req.userId}`
    );
    try {
      const { milestoneId } = req.params;
      const milestone = await this.milestoneService.submitMilestone(
        milestoneId,
        req.userId
      );
      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: "Milestone not found or not submitted",
        });
      }
      return res.status(200).json({ success: true, data: milestone });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  };

  public disputeMilestone = async (req: AuthReq, res: Response) => {
    logger.info(
      `[MilestoneController] ${req.method} ${req.url} by user ${req.userId}`
    );
    try {
      const { milestoneId } = req.params;
      const milestone = await this.milestoneService.disputeMilestone(
        milestoneId,
        req.userId
      );
      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: "Milestone not found or not disputed",
        });
      }
      return res.status(200).json({ success: true, data: milestone });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  };

  public approveWorkByClient = async (req: AuthReq, res: Response) => {
    logger.info(
      `[MilestoneController] ${req.method} ${req.url} by user ${req.userId}`
    );
    try {
      const { milestoneId } = req.params;
      const milestone = await this.milestoneService.approveWorkByClient(
        milestoneId,
        req.userId
      );
      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: "Milestone not found or work not approved",
        });
      }
      return res.status(200).json({ success: true, data: milestone });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  };

  public requestDeletion = async (req: AuthReq, res: Response) => {
    logger.info(
      `[MilestoneController] ${req.method} ${req.url} by user ${req.userId}`
    );
    try {
      const { milestoneId } = req.params;
      const milestone = await this.milestoneService.requestDeletion(
        milestoneId,
        req.userId
      );
      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: "Milestone not found or deletion not requested",
        });
      }
      return res.status(200).json({ success: true, data: milestone });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  };

  public acceptRequestDeletion = async (req: AuthReq, res: Response) => {
    logger.info(
      `[MilestoneController] ${req.method} ${req.url} by user ${req.userId}`
    );
    try {
      const { milestoneId } = req.params;
      const milestone = await this.milestoneService.acceptRequestDeletion(
        milestoneId,
        req.userId
      );
      if (!milestone) {
        return res.status(404).json({
          success: false,
          message: "Milestone not found or deletion request not accepted",
        });
      }
      return res.status(200).json({ success: true, data: milestone });
    } catch (err) {
      return this.handleError(err, req, res);
    }
  };
}

export default MilestoneController;
