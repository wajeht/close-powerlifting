import express, { Request, Response } from "express";

const router = express.Router();

/**
 * GET /api/health-check
 * @tags health-check
 * @summary get the health of open powerlifting api
 * @return {object} 200 - success response
 */
router.get("/", async (req: Request, res: Response) => {
  const data: any = [];

  res.status(200).json({
    status: "success",
    request_url: req.originalUrl,
    message: "ok",
    cache: req.query?.cache,
    data,
  });
});

export default router;
