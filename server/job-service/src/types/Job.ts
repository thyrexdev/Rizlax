import { Job, JobStatus, Proposal, Review } from "@prisma/client"

// ===============================================
// REQUEST INTERFACES
// ===============================================

export interface CreateJobRequest {
  title: string;
  description: string;
  budget: number; // Float
  category: string;
}

export interface UpdateJobRequest extends Partial<CreateJobRequest> {
  status?: JobStatus;
}

export interface GetClientJobsFilters {
  page: number;
  limit: number;
  status?: JobStatus;
  category?: string;
}

export interface GetJobProposalsFilters {
  page: number;
  limit: number;
}

export interface BrowseJobsFilters {
  page: number;
  limit: number;
  category?: string;
  minBudget?: number; // Float
  maxBudget?: number; // Float
  status?: JobStatus;
  search?: string;
}


// ===============================================
// RESPONSE & UTILITY INTERFACES
// ===============================================

// Generic Pagination Structure
interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// Type for Job with Client details and Proposal count
export type JobWithDetails = Job & {
  client: { 
    id: string; 
    fullName: string; 
    companyName: string | null; 
    user: { id: string; name: string; email: string; } 
  };
  _count: { proposals: number };
};


// Response for fetching client's jobs
export interface ClientJobsResponse {
  jobs: JobWithDetails[];
  pagination: Pagination;
}

// Response for browsing public jobs
export interface BrowseJobsResponse {
  jobs: JobWithDetails[];
  pagination: Pagination;
}

// Response for fetching job proposals (Detailed for client)
export type ProposalWithDetails = Proposal & {
  freelancer: {
    user: { id: string; name: string; email: string };
    skills: { id: string; name: string }[];
    _count: { contracts: number; reviews: number };
  };
};

export interface JobProposalsResponse {
  proposals: ProposalWithDetails[];
  pagination: Pagination;
}

export interface DeleteJobResponse {
  message: string;
}

// Interface for Client Job Statistics
export interface JobStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  inProgressJobs: number;
  canceledJobs: number;
  totalProposals: number;
  totalSpent: number;
  averageBudget: number;
}

// Interface for Job Market Statistics
export interface JobMarketStats {
  totalOpenJobs: number;
  totalJobsThisWeek: number;
  averageBudget: number;
  topCategories: Array<{ category: string; count: number }>;
}
