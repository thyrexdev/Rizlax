import dotenv from "dotenv";
import App from "./core/App.ts";
import { connectDB } from "db-client/index.ts";
import logger from "logs/index.ts";
import ContractService from "./services/Contract.ts";
import ContractController from "./controllers/Contract.ts";
import { createContractRouter } from "./routes/Contract.ts";
import MilestoneService from "./services/Milstone.ts";
import MilestoneController from "./controllers/Milestone.ts";
import { createMilestoneRouter } from "./routes/Milestone.ts";

dotenv.config({ path: "../../.env" });

const PORT = parseInt(process.env.PORT || "3003", 10);

async function startServer() {
  try {
    console.log("Starting Contract Service Setup...");

    // service initialization
    const contractService = new ContractService();
    const milestoneService = new MilestoneService(contractService);
    // controller initialization
    const contractController = new ContractController(contractService);
    const milestoneController = new MilestoneController(milestoneService);
    // router initialization
    const contractRouter = createContractRouter(contractController);
    const milestoneRouter = createMilestoneRouter(milestoneController);

    const routers = [
      { path: "/api/contract", router: contractRouter },
      { path: "/api/milestone", router: milestoneRouter },
    ];

    console.log("Connecting to database...");
    for (let i = 0; i < 5; i++) {
      try {
        await connectDB();
        break;
      } catch {
        console.log("Retrying DB connection...");
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    console.log("Database connected successfully.");

    const server = new App(PORT, routers);
    server.listen();
  } catch (error) {
    logger.error("Contract Service failed to start:", { error });
    console.log("Contract Service failed to start:", error);
    process.exit(1);
  }
}

startServer();
