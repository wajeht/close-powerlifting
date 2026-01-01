import express, { Request, Response } from "express";
import catchAsyncHandler from "express-async-handler";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { emailConfig } from "../../config/constants";
import cache from "../../db/cache";
import { getDb } from "../../db/db";
import { isCronServiceStarted } from "../../utils/crons";
import mail from "../../utils/mail";
import contactHTML from "../../utils/templates/contact";
import { validationMiddleware } from "../middleware";
import * as RankingsService from "../api/rankings/rankings.service";

const router = express.Router();

/**
 * GET /
 * @tags general
 * @summary get home page
 */
router.get(
  "/",
  catchAsyncHandler(async (req: Request, res: Response) => {
    const rankings = await RankingsService.getRankings({ current_page: 1, per_page: 5, cache: true });

    return res.status(StatusCodes.OK).render("general/general-home.html", {
      path: "/home",
      rankings,
    });
  }),
);

/**
 * GET /about
 * @tags general
 * @summary get about page
 */
router.get("/about", (req: Request, res: Response) => {
  return res.status(StatusCodes.OK).render("general/general-about.html", {
    path: "/about",
  });
});

/**
 * GET /contact
 * @tags general
 * @summary get contact page
 */
router.get("/contact", (req: Request, res: Response) => {
  return res.status(StatusCodes.OK).render("general/general-contact.html", {
    path: "/contact",
    messages: req.flash(),
  });
});

/**
 * POST /contact
 * @tags general
 * @summary post contact page
 */
router.post(
  "/contact",
  validationMiddleware({
    body: z.object({
      email: z
        .string({ required_error: "email is required!" })
        .email({ message: "must be valid email address!" }),
      name: z.string({ required_error: "name is required!" }),
      message: z.string({ required_error: "message is required!" }),
    }),
  }),
  catchAsyncHandler(async (req: Request, res: Response) => {
    const { name, email, message } = req.body;

    mail.sendMail({
      from: `"Close Powerlifting" <${emailConfig.auth_email}>`,
      to: emailConfig.auth_email,
      subject: `Contact Request from ${email}`,
      html: contactHTML({ name, email, message }),
    });

    req.flash("info", "Thanks for reaching out to us. We'll get back to you shortly!");

    return res.status(StatusCodes.TEMPORARY_REDIRECT).redirect("/contact");
  }),
);

/**
 * GET /terms
 * @tags general
 * @summary get terms page
 */
router.get("/terms", (req: Request, res: Response) => {
  return res.status(StatusCodes.OK).render("general/general-terms.html", {
    path: "/terms",
  });
});

/**
 * GET /privacy
 * @tags general
 * @summary get privacy page
 */
router.get("/privacy", (req: Request, res: Response) => {
  return res.status(StatusCodes.OK).render("general/general-privacy.html", {
    path: "/privacy",
  });
});

/**
 * GET /status
 * @tags general
 * @summary get status page
 */
router.get("/status", (req: Request, res: Response) => {
  return res.status(StatusCodes.OK).render("general/general-status.html", {
    path: "/status",
  });
});

/**
 * GET /healthz
 * @tags general
 * @summary get the health of close-powerlifting app (for docker/k8s)
 */
router.get("/healthz", (req: Request, res: Response) => {
  let dbConnected = false;
  try {
    getDb();
    dbConnected = true;
  } catch {
    dbConnected = false;
  }

  res.status(StatusCodes.OK).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: Date.now(),
    database: dbConnected ? "connected" : "disconnected",
    cache: cache.isReady() ? "connected" : "disconnected",
    crons: isCronServiceStarted() ? "started" : "stopped",
  });
});

export default router;
