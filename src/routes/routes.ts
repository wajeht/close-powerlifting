import express from "express";

import { ApiRouter } from "./api/api";
import { AuthRouter } from "./auth/auth";
import { GeneralRouter } from "./general/general";

export function MainRouter() {
  const router = express.Router();

  router.use("/", GeneralRouter());
  router.use("/", AuthRouter());
  router.use("/api/auth", AuthRouter());
  router.use("/api", ApiRouter());

  return router;
}
