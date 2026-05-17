import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { sendSuccess } from "../api.helpers";

export function createStatusRouter(context: AppContext) {
  const router = express.Router();

  /**
   * GET /api/status
   * @summary Snapshot metadata + entity counts
   * @tags Status
   * @return {object} 200 - Counts plus the source CSV's Last-Modified header
   * @return {object} 503 - Data is still warming up after boot
   */
  router.get("/api/status", (req: Request, res: Response) => {
    const data = context.store.tryGet();
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
    sendSuccess(
      res,
      {
        lifters: data.lifters.length,
        meets: data.meets.length,
        entries: data.entries.length,
        federations: data.federations.length,
        records: data.records.length,
        source_last_modified: data.sourceLastModified,
        ingested_at: data.ingestedAt,
      },
      { requestUrl: req.originalUrl },
    );
  });

  return router;
}
