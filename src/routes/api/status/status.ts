import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";

export function createStatusRouter(context: AppContext) {
  const router = express.Router();

  /**
   * GET /api/status
   * @summary Snapshot metadata + entity counts
   * @tags Status
   * @return {object} 200 - Counts plus the source CSV's Last-Modified header
   * @return {object} 503 - Data is still warming up after boot
   */
  router.get("/api/status", (_req: Request, res: Response) => {
    const data = context.store.tryGet();
    if (data == null) {
      res.status(503).json({
        status: "warming up",
        data: null,
        errors: [],
      });
      return;
    }
    res.status(200).json({
      status: "success",
      data: {
        lifters: data.lifters.length,
        meets: data.meets.length,
        entries: data.entries.length,
        federations: data.federations.length,
        records: data.records.length,
        source_last_modified: data.sourceLastModified,
        ingested_at: data.ingestedAt,
      },
    });
  });

  return router;
}
