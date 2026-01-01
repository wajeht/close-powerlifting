import express from "express";

import apiRouter from "./api/api";
import authRouter from "./auth/auth";
import generalRouter from "./general/general";

const router = express.Router();

router.use("/", generalRouter);
router.use("/", authRouter);
router.use("/api/auth", authRouter);
router.use("/api", apiRouter);

export default router;
