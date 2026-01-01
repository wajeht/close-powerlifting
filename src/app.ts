import compression from "compression";
import flash from "connect-flash";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import path from "path";

import { config } from "./config";
import {
  errorMiddleware,
  hostNameMiddleware,
  notFoundMiddleware,
  rateLimitMiddleware,
  sessionMiddleware,
} from "./routes/middleware";
import routes from "./routes/routes";
import { expressJSDocSwaggerHandler } from "./utils/swagger";
import { engine, layoutMiddleware } from "./utils/template";

const app = express();

app.disable("x-powered-by");

app.use(hostNameMiddleware);

app.set("trust proxy", true);

app.use(cookieParser());

app.use(flash());

app.use(sessionMiddleware());

app.use(cors({ credentials: true, origin: true }));

app.use(compression());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.static(path.resolve(path.join(process.cwd(), "public")), { maxAge: "30d" }));

app.engine("html", engine);

app.set("view engine", "html");

app.set("views", path.resolve(path.join(process.cwd(), "src", "routes")));

app.set("view cache", config.app.env === "production");

app.use(layoutMiddleware);

expressJSDocSwaggerHandler(app);

app.use(rateLimitMiddleware());

app.use(routes);

app.use(notFoundMiddleware);

app.use(errorMiddleware);

export default app;
