import type { Request, Response } from "express";
import z from "zod";
import DomainError from "common-middleware/src/DomainError.ts";
import type { Contract } from "@prisma/client"
import type { CreateContractDTO } from "../services/Contract.ts"
import logger from "logs/index.ts";

const createContractSchema = z.object({
  clientId: z.string().uuid(),
  freelancerId: z.string().uuid(),
  jobId: z.string().uuid(),
  amount: z.number().min(50),
  startDate: z.string().transform((d) => new Date(d)),
  endDate: z
    .string()
    .optional()
    .transform((d) => (d ? new Date(d) : undefined)),
});

type AuthReq = Request & { userId: string };

export interface IContractService {
  getContractById: (contractId: string) => Promise<Contract | null>;
  createContract: (data: CreateContractDTO) => Promise<Contract>;
  startContract: (contractId: string) => Promise<Contract | null>;
  submitWork: (contractId: string) => Promise<Contract | null>;
  completeContract: (contractId: string) => Promise<Contract | null>;
  disputeContract: (contractId: string) => Promise<Contract | null>;
  terminateContract: (contractId: string) => Promise<Contract | null>;
}


class ContractController {

    private contractService: IContractService;

  constructor(contractService: IContractService) {
    this.contractService = contractService;
  }

  private handleError(err: unknown, res: Response) {
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

    logger.error("Unexpected error in ContractController", err);
    return res.status(500).json({ message: "Internal server error" });
  }

  private validateUserAccess(contractId: string, userId: string) {
    if (!contractId) {
      throw new DomainError(
        "Contract ID is required",
        "MISSING_CONTRACT_ID",
        400
      );
    }

    return this.contractService.getContractById(contractId).then((contract) => {
      if (!contract) {
        throw new DomainError("Contract not found", "CONTRACT_NOT_FOUND", 404);
      }

      if (contract.clientId !== userId && contract.freelancerId !== userId) {
        throw new DomainError("Access denied", "ACCESS_DENIED", 403);
      }

      return contract;
    });
  }

  private validateClientAccess(contractId: string, userId: string) {
    if (!contractId) {
      throw new DomainError(
        "Contract ID is required",
        "MISSING_CONTRACT_ID",
        400
      );
    }

    return this.contractService.getContractById(contractId).then((contract) => {
      if (!contract) {
        throw new DomainError("Contract not found", "CONTRACT_NOT_FOUND", 404);
      }

      if (contract.clientId !== userId) {
        throw new DomainError("Access denied", "ACCESS_DENIED", 403);
      }

      return contract;
    });
  }

  private validateFreelancerAccess(contractId: string, userId: string) {
    if (!contractId) {
      throw new DomainError(
        "Contract ID is required",
        "MISSING_CONTRACT_ID",
        400
      );
    }

    return this.contractService.getContractById(contractId).then((contract) => {
      if (!contract) {
        throw new DomainError("Contract not found", "CONTRACT_NOT_FOUND", 404);
      }

      if (contract?.freelancerId !== userId) {
        throw new DomainError("Access denied", "ACCESS_DENIED", 403);
      }

      return contract;
    });
  }

  public createContract = async (req: AuthReq, res: Response) => {
    try {
      const parsed = createContractSchema.parse(req.body);
      const dto = {
        ...parsed,
        clientId: req.userId,
      };
      const contract = await this.contractService.createContract(dto);
      res.status(201).json(contract);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  public getContractById = async (req: AuthReq, res: Response) => {
    try {
      const { contractId } = req.params;

      const contract = await this.validateUserAccess(contractId, req.userId);

      return res.status(200).json(contract);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  public startContract = async (req: AuthReq, res: Response) => {
    try {
      const { contractId } = req.params;

      const contract = await this.validateClientAccess(contractId, req.userId);

      // Ensure the contract is in PENDING status
      if (contract.status !== "PENDING") {
        throw new DomainError(
          "Only pending contracts can be started",
          "INVALID_CONTRACT_STATUS",
          400
        );
      }

      const startedContract = await this.contractService.startContract(
        contractId
      );
      return res.status(200).json(startedContract);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  public submitWork = async (req: AuthReq, res: Response) => {
    try {
      const { contractId } = req.params;

      const contract = await this.validateFreelancerAccess(
        contractId,
        req.userId
      );

      // Ensure the contract is in ACTIVE status
      if (contract.status !== "ACTIVE") {
        throw new DomainError(
          "Only active contracts can have work submitted",
          "INVALID_CONTRACT_STATUS",
          400
        );
      }

      const submittedContract = await this.contractService.submitWork(
        contractId
      );
      return res.status(200).json(submittedContract);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  public completeContract = async (req: AuthReq, res: Response) => {
    try {
      const { contractId } = req.params;

      const contract = await this.validateClientAccess(contractId, req.userId);

      // Ensure the contract is in REVIEW_PENDING status
      if (contract.status !== "REVIEW_PENDING") {
        throw new DomainError(
          "Only contracts pending review can be completed",
          "INVALID_CONTRACT_STATUS",
          400
        );
      }

      const completedContract = await this.contractService.completeContract(
        contractId
      );
      return res.status(200).json(completedContract);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  public disputeContract = async (req: AuthReq, res: Response) => {
    try {
      const { contractId } = req.params;

      const contract = await this.validateClientAccess(contractId, req.userId);

      // Ensure the contract is in REVIEW_PENDING status
      if (contract.status !== "REVIEW_PENDING") {
        throw new DomainError(
          "Only contracts pending review can be completed",
          "INVALID_CONTRACT_STATUS",
          400
        );
      }

      const disputedContract = await this.contractService.disputeContract(
        contractId
      );
      return res.status(200).json(disputedContract);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  public terminateContract = async (req: AuthReq, res: Response) => {
    try {
      const { contractId } = req.params;
      const contract = await this.validateUserAccess(contractId, req.userId);

      // Ensure the contract is not already completed or terminated
      if (contract.status === "COMPLETED" || contract.status === "TERMINATED") {
        throw new DomainError(
          "Completed or terminated contract cannot be terminated again",
          "INVALID_CONTRACT_sTATUS",
          400
        );
      }

      const terminatedContract = await this.contractService.terminateContract(
        contractId
      );
      return res.status(200).json(terminatedContract);
    } catch (error) {
      this.handleError(error, res);
    }
  };
}

export default ContractController;
