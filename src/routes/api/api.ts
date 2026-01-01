import express from "express";

import { authenticationMiddleware, trackAPICallsMiddleware } from "../middleware";
import { federationsRouter } from "./federations/federations";
import { healthCheckRouter } from "./health-check/health-check";
import { meetsRouter } from "./meets/meets";
import { rankingsRouter } from "./rankings/rankings";
import { recordsRouter } from "./records/records";
import { statusRouter } from "./status/status";
import { usersRouter } from "./users/users";

const apiRouter = express.Router();

// Protected API routes (require authentication)
apiRouter.use("/rankings", authenticationMiddleware, trackAPICallsMiddleware, rankingsRouter);
apiRouter.use("/federations", authenticationMiddleware, trackAPICallsMiddleware, federationsRouter);
apiRouter.use("/meets", authenticationMiddleware, trackAPICallsMiddleware, meetsRouter);
apiRouter.use("/records", authenticationMiddleware, trackAPICallsMiddleware, recordsRouter);
apiRouter.use("/users", authenticationMiddleware, trackAPICallsMiddleware, usersRouter);

// Public API routes (no authentication required)
apiRouter.use("/status", statusRouter);
apiRouter.use("/health-check", healthCheckRouter);

export { apiRouter };
