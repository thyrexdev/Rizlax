import { prisma } from "db-client/index.ts";
import {  ContractStatus } from "@prisma/client";
import type { Contract } from "@prisma/client"
import DomainError from "common-middleware/src/DomainError.ts";

export interface CreateContractDTO {
  clientId: string;
  freelancerId: string;
  jobId: string;
  amount: number;
  status?: ContractStatus;
  startDate: Date;
  endDate?: Date;
}

const VALID_TRANSITIONS: { [key in ContractStatus]: ContractStatus[] } = {
  [ContractStatus.PENDING]: [ContractStatus.ACTIVE, ContractStatus.TERMINATED],
  [ContractStatus.ACTIVE]: [
    ContractStatus.REVIEW_PENDING,
    ContractStatus.TERMINATED,
  ],
  [ContractStatus.REVIEW_PENDING]: [
    ContractStatus.COMPLETED,
    ContractStatus.DISPUTED,
    ContractStatus.TERMINATED,
  ],
  [ContractStatus.COMPLETED]: [],
  [ContractStatus.DISPUTED]: [ContractStatus.TERMINATED],
  [ContractStatus.TERMINATED]: [],
};

class ContractService {
  private async validateContractExists(contractId: string): Promise<Contract> {
    const contract = await this.getContractById(contractId);
    if (!contract) {
      throw new DomainError("Contract not found", "CONTRACT_NOT_FOUND", 404);
    }
    return contract;
  }

  private validateStatusTransition(from: ContractStatus, to: ContractStatus) {
    const allowed = VALID_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new DomainError(
        "invalid contract status transition",
        "INVALID_CONTRACT_STATUS_TRANSITION",
        400
      );
    }
  }

  public async getContractById(contractId: string): Promise<Contract | null> {
    return prisma.contract.findUnique({
      where: { id: contractId },
    });
  }

  public async createContract(data: CreateContractDTO) {
    return prisma.contract.create({
      data,
    });
  }

  public async startContract(contractId: string): Promise<Contract | null> {
    const contract = await this.validateContractExists(contractId);

    this.validateStatusTransition(contract.status, ContractStatus.ACTIVE);

    return prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.ACTIVE, startDate: new Date() },
    });
  }

  public async submitWork(contractId: string): Promise<Contract | null> {
    const contract = await this.validateContractExists(contractId);

    this.validateStatusTransition(
      contract.status,
      ContractStatus.REVIEW_PENDING
    );

    return prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.REVIEW_PENDING, submittedAt: new Date() },
    });
  }

  public async completeContract(contractId: string): Promise<Contract | null> {
    const contract = await this.validateContractExists(contractId);

    this.validateStatusTransition(contract.status, ContractStatus.COMPLETED);

    return prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.COMPLETED, endDate: new Date() },
    });
  }

  public async disputeContract(contractId: string): Promise<Contract | null> {
    const contract = await this.validateContractExists(contractId);

    this.validateStatusTransition(contract.status, ContractStatus.DISPUTED);

    return prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.DISPUTED },
    });
  }

  public async terminateContract(contractId: string): Promise<Contract | null> {
    const contract = await this.validateContractExists(contractId);

    this.validateStatusTransition(contract.status, ContractStatus.TERMINATED);

    // if (
    //   contract.status === ContractStatus.COMPLETED ||
    //   contract.status === ContractStatus.TERMINATED
    // ) {
    //   throw new DomainError("Contract cannot be terminated", "INVALID_CONTRACT_STATUS", 400);
    // }

    return prisma.contract.update({
      where: { id: contractId },
      data: { status: ContractStatus.TERMINATED, endDate: new Date() },
    });
  }

}

export default ContractService;
