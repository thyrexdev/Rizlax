import express from "express";
import type { Application, Request, Response, Router } from "express";
import http, { Server as HttpServer } from "http";
import cors from "cors";
import { verifyToken } from "@rizlax/common-middleware";
import cookieParser from "cookie-parser";


interface RequestWithUser extends Request {
  userId?: string;
}

interface serverRouter {
  path: string;
  router: Router;
}

class APIServer {
  public app: Application;
  public server?: HttpServer;
  private port: number;
  private routers: serverRouter[];

  constructor(port: number, routers: serverRouter[] = []) {
    this.app = express();
    this.port = port;
    this.routers = routers;
    this.initializeMiddlewares();
    this.initializeRoutes();
  }

  private initializeMiddlewares() {
    this.app.use(express.json());
    this.app.use(cookieParser());
    this.app.use(cors());
  }

  private initializeRoutes() {
    this.app.get("/health", (req: Request, res: Response) => {
      res.status(200).send("API Server is healthy");
    });

    this.app.get(
      "/secure-data",
      async (req: RequestWithUser, res: Response) => {
        const token = req.headers["authorization"];
        if (!token) {
          return res.status(401).send("No token provided");
        }
        try {
          const payload = await verifyToken(token as string);
          req.userId = payload.userId;
          res.status(200).send("This is secure data");
        } catch (error) {
          if (error instanceof Error) {
            res.status(401).send(error.message);
          } else {
            res.status(401).send(String(error));
          }
        }
      }
    );

    this.routers.forEach(({ path, router }) => {
      this.app.use(path, router);
    });
  }

  public listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(this.app);
      this.server.listen(this.port, () => {
        console.log(`🚀 API Server running on port ${this.port}`);
        resolve();
      });
    });
  }
}

export default APIServer;
