export enum ProposalStatus {
  PENDING = 'PENDING',
  INTERVIEWING = 'INTERVIEWING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED'
}

export interface Proposal {
  id: string;
  freelancerId: string;
  jobId: string;
  coverLetter: string;
  proposedRate: number;
  status: ProposalStatus;
  createdAt: Date;
}

export interface CreateProposalData {
  freelancerId: string;
  jobId: string;
  coverLetter: string;
  proposedRate: number;
}

export interface UpdateProposalStatusData {
  status: ProposalStatus;
}

export interface ProposalWithDetails extends Proposal {
  freelancer: {
    id: string;
    fullName: string;
    hourlyRate?: number;
    experienceLevel: string;
    bio?: string;
    profilePicture?: string;
    skills: Array<{
      id: string;
      name: string;
    }>;
  };
  job: {
    id: string;
    title: string;
    description: string;
    budget: number;
    category: string;
    client: {
      id: string;
      fullName: string;
      companyName?: string;
    };
  };
}

export interface GetProposalsFilters {
  jobId?: string;
  freelancerId?: string;
  status?: ProposalStatus;
  page?: number;
  limit?: number;
}

// Response interfaces
export interface CreateProposalResponse {
  message: string;
  proposal: Proposal;
}

export interface GetProposalResponse {
  proposal: ProposalWithDetails;
}

export interface GetProposalsResponse {
  proposals: ProposalWithDetails[];
  pagination: PaginationInfo;
}

export interface UpdateProposalStatusResponse {
  message: string;
  proposal: Proposal;
}

export interface DeleteProposalResponse {
  message: string;
}

export interface GetProposalsByJobResponse {
  proposals: ProposalWithDetails[];
}

export interface GetMyProposalsResponse {
  proposals: ProposalWithDetails[];
}

// Utility interfaces
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// Error response interfaces
export interface ProposalErrorResponse {
  error: string;
  details?: any;
}

export interface ValidationErrorResponse {
  error: string;
  details: Array<{
    code: string;
    expected?: string;
    received?: string;
    path: Array<string | number>;
    message: string;
  }>;
}
