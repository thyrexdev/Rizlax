import DomainError from "common-middleware/src/DomainError.ts";
import { Prisma, PrismaClient } from "@prisma/client";

type Contract = Prisma.ContractGetPayload<{}>;

export class ContractValidator {
  public static validateContractExists(contract: Contract | null): void {
    if (!contract) {
      throw new DomainError(
        "Contract was not found",
        "CONTRACT_NOT_FOUND",
        404
      );
    }
  }

  public static validateContractStatus(contract: Contract): void {
    if (contract.status !== "ACTIVE" && contract.status !== "PENDING") {
      throw new DomainError(
        "Contract is not in valid state",
        "CONTRACT_INACTIVE",
        400
      );
    }
  }

  public static validateUserAccess(contract: Contract, userId: string): void {
    const isUserPartOfContract = 
      contract.clientId === userId || contract.freelancerId === userId;

    if (!isUserPartOfContract) {
      throw new DomainError(
        "User is not authorized for this contract",
        "USER_NOT_AUTHORIZED",
        403
      );
    }
  }

  public static validateClientOnly(contract: Contract, userId: string): void {
    if (contract.clientId !== userId) {
      throw new DomainError(
        "Only clients can perform this action",
        "CLIENT_ONLY_ACTION",
        403
      );
    }
  }

  public static validateFreelancerOnly(contract: Contract, userId: string): void {
    if (contract.freelancerId !== userId) {
      throw new DomainError(
        "Only freelancers can perform this action",
        "FREELANCER_ONLY_ACTION",
        403
      );
    }
  }
}