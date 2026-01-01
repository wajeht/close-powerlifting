import express, { Request, Response } from "express";

const router = express.Router();

/**
 * GET /api/health-check
 * @tags health-check
 * @summary get the health of open powerlifting api
 */
router.get(
  "/",
  catchAsyncHandler(async (req: Request, res: Response) => {
    const data: any = [];

    res.status(StatusCodes.OK).json({
      status: "success",
      request_url: req.originalUrl,
      message: "ok",
      cache: req.query?.cache,
      data,
    });
  }),
);

export default router;
