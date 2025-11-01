import express from "express";
import cors from "cors";
import type { Application, Request, Response, Router } from "express";
import cookieParser from "cookie-parser";


interface ServiceRouter {
  path: string;
  router: Router;
}

class App {
  private app: Application;
  private port: number;
  private routers: ServiceRouter[];

  constructor(port: number, routers: ServiceRouter[] = []) {
    this.app = express();
    this.port = port;
    this.routers = routers
    this.initializeMiddlewares();
    this.initializeRoutes();
  }

  private initializeMiddlewares(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(cookieParser());
  }

  private initializeRoutes(): void {
    this.app.get("/", (req: Request, res: Response) => {
      res.status(200).json({ message: "Vync Auth service is Ready" });
    });
    this.routers.forEach(service => {
        this.app.use(service.path, service.router);
        console.log(`Router initialized: ${service.path}`);
    });
  }

  public async listen(): Promise<void> {
    this.app.listen(this.port, () => {
      console.log(`🚀 Auth Server running on port ${this.port}`);
    });
  }
}

export default App;
