import dotenv from "dotenv";
import App from "./core/App.ts";
import { connectDB } from "@rizlax/db-client";
import logger from "@rizlax/logs";

// --- Job Imports ---
import JobService from "./services/Job.ts";
import JobController from "./controllers/Job.ts";
import createJobRouter from "./routes/Job.ts";

// --- Proposal Imports ---
import ProposalService from "./services/Proposal.ts";
import ProposalController from "./controllers/Proposal.ts";
import createProposalRouter from "./routes/Proposal.ts";


dotenv.config({ path: "../../.env" });

const PORT = parseInt(process.env.JOB_PORT || "3002", 10);

async function startServer() {
  try {
    console.log("Starting Job Service dependency setup...");

    const jobService = new JobService();
    const proposalService = new ProposalService(); 

    const jobController = new JobController(jobService);
    const proposalController = new ProposalController(proposalService); 


    const jobRouter = createJobRouter(jobController);
    const proposalRouter = createProposalRouter(proposalController); 

    const routers = [
      { path: "/api/jobs", router: jobRouter },
      { path: "/api/proposals", router: proposalRouter } // إضافة مسارات Proposals
    ];

    console.log("Connecting to database...");
    await connectDB();
    console.log("Database connected successfully.");

    const server = new App(PORT, routers);

    await server.listen();
    console.log(`Job/Proposal Service running on port ${PORT}`);

  } catch (error) {
    logger.error("Job Service failed to start:", { error });
    console.error("Job Service failed to start:", error);
    process.exit(1);
  }
}

startServer();
