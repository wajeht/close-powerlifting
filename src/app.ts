import compression from "compression";
import flash from "connect-flash";
import cookieParser from "cookie-parser";
import cors from "cors";
import ejs from "ejs";
import express from "express";
import expressLayouts from "express-ejs-layouts";
import expressJSDocSwagger from "express-jsdoc-swagger";
import helmet from "helmet";
import path from "path";

import { appConfig } from "./config/constants";
import swaggerConfig from "./config/swagger.config";
import {
  errorMiddleware,
  hostNameMiddleware,
  notFoundMiddleware,
  rateLimitMiddleware,
  sessionMiddleware,
} from "./routes/middleware";
import routes from "./routes/routes";

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

app.engine("html", ejs.renderFile);

app.set("view engine", "html");

app.set("views", path.resolve(path.join(process.cwd(), "src", "routes")));

app.set("layout", path.resolve(path.join(process.cwd(), "src", "routes", "_layouts", "main.html")));

app.set("view cache", appConfig.env === "production");

app.use(expressLayouts);

expressJSDocSwagger(app)(swaggerConfig);

app.use(rateLimitMiddleware());

app.use(routes);

app.use(notFoundMiddleware);

app.use(errorMiddleware);

export default app;
