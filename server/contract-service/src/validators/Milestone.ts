import type { MilestoneDTO } from "../types/MilestoneDTO.ts";
import DomainError from "common-middleware/src/DomainError.ts";

export class MilestoneValidator {
  public static validateMilestoneData(data: MilestoneDTO): void {
    if (data.amount <= 0) {
      throw new DomainError(
        "Milestone amount must be greater than 0",
        "INVALID_AMOUNT",
        400
      );
    }

    if (data.dueDate < new Date()) {
      throw new DomainError(
        "Milestone due date must be in the future",
        "INVALID_DUE_DATE",
        400
      );
    }
  }

  public static validatePartialMilestoneData(data: Partial<MilestoneDTO>): void {
    if (data.amount !== undefined && data.amount <= 0) {
      throw new DomainError(
        "Milestone amount must be greater than 0",
        "INVALID_AMOUNT",
        400
      );
    }

    if (data.dueDate !== undefined && data.dueDate < new Date()) {
      throw new DomainError(
        "Milestone due date must be in the future",
        "INVALID_DUE_DATE",
        400
      );
    }
  }
}