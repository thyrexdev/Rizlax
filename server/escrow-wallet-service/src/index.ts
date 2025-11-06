import dotenv from "dotenv";
import App from "./core/App.ts";
import { connectDB } from "db-client/index.ts";
import logger from "logs/index.ts";
import WalletService from "./services/Wallet.ts";
import EscrowService from "./services/Escrow.ts";
import FinanceController from "./controllers/Finance.ts";
import { createFinanceRouter } from "./routes/Finance.ts";

dotenv.config({ path: "../../.env" });

const PORT = parseInt(process.env.PORT || "3004", 10);

async function startServer() {
  try {
    console.log("Starting Escrow & Wallet Service dependency setup...");

    const walletService = new WalletService();
    const escrowService = new EscrowService();

    const financeController = new FinanceController(
      walletService,
      escrowService
    );

    const financeRouter = createFinanceRouter(financeController);

    const routers = [{ path: "/api/finance", router: financeRouter }];

    console.log("Connecting to database...");
    await connectDB();
    console.log("Database connected successfully.");
    const server = new App(PORT, routers);

    server.listen();
  } catch (error) {
    logger.error("Escrow & Wallet Service failed to start:", { error });
    console.error("Escrow & Wallet Service failed to start:", error);
    process.exit(1);
  }
}


startServer();