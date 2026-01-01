import express from "express";

import { apiRouter } from "./api/api";
import { authRouter } from "./auth/auth";
import { generalRouter } from "./general/general";

const mainRouter = express.Router();

mainRouter.use("/", generalRouter);
mainRouter.use("/", authRouter);
mainRouter.use("/api/auth", authRouter);
mainRouter.use("/api", apiRouter);

export { mainRouter };
