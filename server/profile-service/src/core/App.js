import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
class App {
    app;
    port;
    routers;
    constructor(port, routers = []) {
        this.app = express();
        this.port = port;
        this.routers = routers;
        this.initializeMiddlewares();
        this.initializeRoutes();
    }
    initializeMiddlewares() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(cookieParser());
    }
    initializeRoutes() {
        this.app.get("/", (req, res) => {
            res.status(200).json({ message: "Vync Profile service is Ready" });
        });
        this.routers.forEach(service => {
            this.app.use(service.path, service.router);
            console.log(`Router initialized: ${service.path}`);
        });
    }
    async listen() {
        this.app.listen(this.port, () => {
            console.log(`🚀 Profile Server running on port ${this.port}`);
        });
    }
}
export default App;
