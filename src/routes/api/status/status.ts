import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { createStatusService } from "./status.service";

export function createStatusRouter(context: AppContext) {
  const statusService = createStatusService(context.store);
  const router = express.Router();

  /**
   * GET /api/status
   * @tags Status
   * @summary Get data source status and statistics
   */
  router.get("/api/status", (req: Request, res: Response) => {
    const data = statusService.getStatus();
    if (data == null) {
      res.status(503).json({
        status: "fail",
        request_url: req.originalUrl,
        message: "Data is still warming up",
        errors: [],
        data: [],
      });
      return;
    }
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
    });
  });

  return router;
}
