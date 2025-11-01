import { prisma } from "db-client/index.ts";
import type { Milestone } from "@prisma/client";
import type { MilestoneDTO } from "../types/MilestoneDTO.ts";
import { MilestoneStatus } from "@prisma/client";
import DomainError from "common-middleware/src/DomainError.ts";
import ContractService from "./Contract.ts";
import { ContractValidator } from "../validators/Contract.ts";
import { MilestoneValidator } from "../validators/Milestone.ts";
import type { Contract } from "@prisma/client";



export const VALID_STATUS_TRANSITIONS: Record<
  MilestoneStatus,
  MilestoneStatus[]
> = {
  [MilestoneStatus.PENDING]: [
    MilestoneStatus.IN_PROGRESS,
    MilestoneStatus.CANCELED,
  ],
  [MilestoneStatus.IN_PROGRESS]: [
    MilestoneStatus.SUBMITTED,
    MilestoneStatus.CANCELED,
  ],
  [MilestoneStatus.SUBMITTED]: [
    MilestoneStatus.APPROVED,
    MilestoneStatus.REJECTED,
    MilestoneStatus.DISPUTED,
  ],
  [MilestoneStatus.APPROVED]: [MilestoneStatus.PAID, MilestoneStatus.DISPUTED],
  [MilestoneStatus.PAID]: [MilestoneStatus.COMPLETED],
  [MilestoneStatus.DISPUTED]: [
    MilestoneStatus.APPROVED,
    MilestoneStatus.REJECTED,
  ],
  [MilestoneStatus.CANCELED]: [],
  [MilestoneStatus.COMPLETED]: [],
  [MilestoneStatus.REJECTED]: [
    MilestoneStatus.IN_PROGRESS,
    MilestoneStatus.CANCELED,
  ],
};

class MilestoneService {
  private bypassAdmin = process.env.BYPASS_ADMIN_VALIDATIONS === "true";
  private contractService: ContractService;

  constructor(
    contractService: ContractService,
    isAdmin: boolean = false
  ) {
    this.contractService = contractService;
    this.bypassAdmin = isAdmin || this.bypassAdmin;
  }

  protected async validateAndGetContext(milestoneId: string, userId: string) {
    const milestone = await this.getMilestone(milestoneId);
    const contract = await this.getAndValidateContract(
      milestone.contractId,
      userId
    );
    return { milestone, contract };
  }

  private async getMilestone(milestoneId: string) {
    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
    });
    if (!milestone) {
      throw new DomainError("Milestone not found", "MILESTONE_NOT_FOUND", 404);
    }
    return milestone;
  }

  private async getAndValidateContract(contractId: string, userId: string) {
    const contract = await this.contractService.getContractById(contractId);
    ContractValidator.validateContractExists(contract);
    ContractValidator.validateContractStatus(contract!);
    ContractValidator.validateUserAccess(contract!, userId);
    return contract!;
  }

  private validateStatusTransition(from: MilestoneStatus, to: MilestoneStatus) {
    const validateNextStatuses = VALID_STATUS_TRANSITIONS[from];

    if (this.bypassAdmin) return;
    if (!validateNextStatuses.includes(to)) {
      throw new DomainError(
        `Invalid milestone status transition from ${from} to ${to}`,
        "INVALID_MILESTONE_STATUS_TRANSITION",
        400
      );
    }
  }

  private withMilestoneContext = async <T>(
    milestoneId: string,
    userId: string,
    role: "CLIENT" | "FREELANCER",
    callback: (ctx: { milestone: Milestone; contract: Contract }) => Promise<T>
  ): Promise<T> => {
    const { milestone, contract } = await this.validateAndGetContext(
      milestoneId,
      userId
    );
    ContractValidator[`validate${role}Only`](contract!, userId);
    return callback({ milestone, contract });
  };

  public async createMilestone(
    data: MilestoneDTO,
    userId: string
  ): Promise<Milestone> {
    await this.getAndValidateContract(data.contractId, userId);

    const contract = await this.getAndValidateContract(data.contractId, userId);

    ContractValidator.validateClientOnly(contract!, userId);
    MilestoneValidator.validateMilestoneData(data);

    return await prisma.$transaction(async (tx) => {
      const count = await tx.milestone.count({
        where: { contractId: data.contractId },
      });

      const milestone = await tx.milestone.create({
        data: {
          contractId: data.contractId,
          title: data.title,
          description: data.description,
          amount: data.amount,
          dueDate: data.dueDate,
          sequence: count + 1,
        },
      });

      return milestone;
    });
  }

  public async getMilestones(
    contractId: string,
    userId: string
  ): Promise<Milestone[]> {
    return this.withMilestoneContext(
      contractId,
      userId,
      "CLIENT",
      async ({ contract }) => {
        return await prisma.milestone.findMany({
          where: { contractId },
          orderBy: { sequence: "asc" },
        });
      }
    );
  }

  public async getMilestoneById(
    milestoneId: string
  ): Promise<Milestone | null> {
    return await prisma.milestone.findUnique({
      where: { id: milestoneId },
    });
  }

  public async updateMilestone(
    milestoneId: string,
    userId: string,
    data: Partial<MilestoneDTO>
  ) {
    return this.withMilestoneContext(
      milestoneId,
      userId,
      "CLIENT",
      async ({ milestone, contract }) => {
        MilestoneValidator.validatePartialMilestoneData(data);

        if (milestone.status !== MilestoneStatus.PENDING) {
          throw new DomainError(
            "Only milestones with PENDING status can be updated",
            "INVALID_MILESTONE_UPDATE",
            400
          );
        }

        return await prisma.milestone.update({
          where: { id: milestoneId },
          data: {
            title: data.title,
            description: data.description,
            amount: data.amount,
            dueDate: data.dueDate,
          },
        });
      }
    );
  }

  public async markMilestoneAsApprovedByFreelancer(
    milestoneId: string,
    userId: string
  ) {
    return this.withMilestoneContext(
      milestoneId,
      userId,
      "FREELANCER",
      async ({ milestone, contract }) => {
        this.validateStatusTransition(
          milestone.status as MilestoneStatus,
          MilestoneStatus.APPROVED
        );
        return await prisma.milestone.update({
          where: { id: milestoneId },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
          },
        });
      }
    );
  }

  public async rejectMilestone(milestoneId: string, userId: string) {
    return this.withMilestoneContext(
      milestoneId,
      userId,
      "FREELANCER",
      async ({ milestone, contract }) => {
        this.validateStatusTransition(
          milestone.status as MilestoneStatus,
          MilestoneStatus.REJECTED
        );
        return await prisma.milestone.update({
          where: { id: milestoneId },
          data: {
            status: "REJECTED",
          },
        });
      }
    );
  }

  public async submitMilestone(milestoneId: string, userId: string) {
    return this.withMilestoneContext(
      milestoneId,
      userId,
      "FREELANCER",
      async ({ milestone, contract }) => {
        this.validateStatusTransition(
          milestone.status as MilestoneStatus,
          MilestoneStatus.SUBMITTED
        );
        return await prisma.milestone.update({
          where: { id: milestoneId },
          data: {
            status: "SUBMITTED",
            submittedAt: new Date(),
          },
        });
      }
    );
  }

  public async disputeMilestone(milestoneId: string, userId: string) {
    return this.withMilestoneContext(
      milestoneId,
      userId,
      "CLIENT",
      async ({ milestone, contract }) => {
        this.validateStatusTransition(
          milestone.status as MilestoneStatus,
          MilestoneStatus.DISPUTED
        );
        return await prisma.milestone.update({
          where: { id: milestoneId },
          data: {
            status: "DISPUTED",
            disputedAt: new Date(),
          },
        });
      }
    );


  }

  public async approveWorkByClient(milestoneId: string, userId: string) {
    return this.withMilestoneContext(
      milestoneId,
      userId,
      "CLIENT",
      async ({ milestone, contract }) => {
        this.validateStatusTransition(
          milestone.status as MilestoneStatus,
          MilestoneStatus.COMPLETED
        );
        return await prisma.milestone.update({
          where: { id: milestoneId },
          data: {
            status: "COMPLETED",
            approvedAt: new Date(),
          },
        });
      }
    );

    // TODO: Additional business logic for payment processing can be added here
  }

  public async requestDeletion(milestoneId: string, userId: string) {
    return this.withMilestoneContext(
      milestoneId,
      userId,
      "CLIENT",
      async ({ milestone, contract }) => {
        return await prisma.milestone.update({
          where: { id: milestoneId },
          data: {
            deletionRequestedAt: new Date(),
          },
        });
      }
    );
  }

  public async acceptRequestDeletion(milestoneId: string, userId: string) {
    return this.withMilestoneContext(
      milestoneId,
      userId,
      "FREELANCER",
      async ({ milestone, contract }) => {
        if (!milestone.deletionRequestedAt) {
          throw new DomainError(
            "No deletion request found",
            "NO_DELETION_REQUEST",
            400
          );
        }

        // TODO: Notify both parties about the deletion
        return await prisma.milestone.delete({
          where: { id: milestoneId },
        });
      }
    );
  }
}

export default MilestoneService;
