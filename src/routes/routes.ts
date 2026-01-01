import express from "express";

import apiRouter from "./api/api";
import authRouter from "./auth/auth";
import generalRouter from "./general/general";

const router = express.Router();

// General routes (home, about, contact, etc.)
router.use("/", generalRouter);

// Auth routes (register, reset-api-key, verify-email, oauth)
router.use("/", authRouter);

// API auth routes (mounted at /api/auth/*)
router.use("/api/auth", authRouter);

// API routes (mounted at /api/*)
router.use("/api", apiRouter);

export default router;
