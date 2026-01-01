import express from "express";

import { authenticationMiddleware, trackAPICallsMiddleware } from "../middleware";
import federationsRouter from "./federations/federations";
import healthCheckRouter from "./health-check/health-check";
import meetsRouter from "./meets/meets";
import rankingsRouter from "./rankings/rankings";
import recordsRouter from "./records/records";
import statusRouter from "./status/status";
import usersRouter from "./users/users";

const router = express.Router();

// Protected API routes (require authentication)
router.use("/rankings", authenticationMiddleware, trackAPICallsMiddleware, rankingsRouter);
router.use("/federations", authenticationMiddleware, trackAPICallsMiddleware, federationsRouter);
router.use("/meets", authenticationMiddleware, trackAPICallsMiddleware, meetsRouter);
router.use("/records", authenticationMiddleware, trackAPICallsMiddleware, recordsRouter);
router.use("/users", authenticationMiddleware, trackAPICallsMiddleware, usersRouter);

// Public API routes (no authentication required)
router.use("/status", statusRouter);
router.use("/health-check", healthCheckRouter);

export default router;
