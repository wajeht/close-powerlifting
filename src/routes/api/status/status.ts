import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { createStatusService } from "./status.service";

/**
 * Status data
 * @typedef {object} StatusData
 * @property {number} lifters - Total distinct lifters in the snapshot
 * @property {number} meets - Total distinct meets in the snapshot
 * @property {number} entries - Total per-lifter-per-meet entries
 * @property {number} federations - Total distinct federations
 * @property {number} records - Total precomputed top-3 record rows
 * @property {string} source_last_modified - HTTP Last-Modified of the upstream OPL bulk CSV
 * @property {string} ingested_at - ISO timestamp when the snapshot was built
 */

/**
 * Status response
 * @typedef {object} StatusResponse
 * @property {string} status - Response status (success)
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {StatusData} data - Snapshot statistics
 */

/**
 * Status warming-up response
 * @typedef {object} StatusWarmingUpResponse
 * @property {string} status - Response status (fail)
 * @property {string} request_url - Request URL
 * @property {string} message - "Data is still warming up"
 * @property {object[]} errors - Empty array
 * @property {object[]} data - Empty array
 */

export function createStatusRouter(context: AppContext) {
  const statusService = createStatusService(context.store);
  const router = express.Router();

  /**
   * GET /api/status
   * @tags Status
   * @summary Get data source status and statistics
   * @description Returns counts of every entity in the loaded snapshot plus the upstream `Last-Modified` header from the OpenPowerlifting bulk CSV that produced it. Anonymous endpoint — exposed without auth so external monitors can poll freshness.
   * @return {StatusResponse} 200 - Snapshot metadata + counts
   * @return {StatusWarmingUpResponse} 503 - Snapshot still loading
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/status",
   *   "message": "The resource was returned successfully!",
   *   "data": {
   *     "lifters": 1003428,
   *     "meets": 61808,
   *     "entries": 3925887,
   *     "federations": 465,
   *     "records": 17039,
   *     "source_last_modified": "Sat, 16 May 2026 02:05:25 GMT",
   *     "ingested_at": "2026-05-17T11:09:42.451Z"
   *   }
   * }
   * @example response - 503 - Warming up
   * {
   *   "status": "fail",
   *   "request_url": "/api/status",
   *   "message": "Data is still warming up",
   *   "errors": [],
   *   "data": []
   * }
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
