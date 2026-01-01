import express, { Request, Response } from "express";
import { z } from "zod";

import { config } from "../../config";
import { cache } from "../../db/cache";
import { getDb } from "../../db/db";
import { isCronServiceStarted } from "../../utils/crons";
import { getHostName } from "../../utils/helpers";
import { mail } from "../../utils/mail";
import { createContactText } from "../../utils/templates/contact";
import { validationMiddleware } from "../middleware";
import { getAPIStatus } from "../api/health-check/health-check.service";
import { getRankings } from "../api/rankings/rankings.service";

const generalRouter = express.Router();

generalRouter.get("/", async (req: Request, res: Response) => {
  const rankings = await getRankings({
    current_page: 1,
    per_page: 5,
    cache: true,
  });

  return res.status(200).render("general/general-home.html", {
    path: "/home",
    rankings,
  });
});

generalRouter.get("/about", (req: Request, res: Response) => {
  return res.status(200).render("general/general-about.html", {
    path: "/about",
  });
});

generalRouter.get("/contact", (req: Request, res: Response) => {
  return res.status(200).render("general/general-contact.html", {
    path: "/contact",
    messages: req.flash(),
  });
});

generalRouter.post(
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
  async (req: Request, res: Response) => {
    const { name, email, message } = req.body;

    mail.sendMail({
      from: `"Close Powerlifting" <${config.email.user}>`,
      to: config.email.user,
      subject: `Contact Request from ${email}`,
      text: createContactText({ name, email, message }),
    });

    req.flash("info", "Thanks for reaching out to us. We'll get back to you shortly!");

    return res.status(307).redirect("/contact");
  },
);

generalRouter.get("/terms", (req: Request, res: Response) => {
  return res.status(200).render("general/general-terms.html", {
    path: "/terms",
  });
});

generalRouter.get("/privacy", (req: Request, res: Response) => {
  return res.status(200).render("general/general-privacy.html", {
    path: "/privacy",
  });
});

generalRouter.get("/status", async (req: Request, res: Response) => {
  const hostname = getHostName(req);
  const apiStatuses = await getAPIStatus({
    X_API_KEY: config.app.xApiKey,
    url: hostname,
  });

  const allGood = apiStatuses.every((item: { status: boolean }) => item.status);

  return res.status(200).render("general/general-status.html", {
    path: "/status",
    apiStatuses,
    allGood,
  });
});

generalRouter.get("/health-check", (req: Request, res: Response) => {
  let dbConnected = false;
  try {
    getDb();
    dbConnected = true;
  } catch {
    dbConnected = false;
  }

  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: Date.now(),
    database: dbConnected ? "connected" : "disconnected",
    cache: cache.isReady() ? "connected" : "disconnected",
    crons: isCronServiceStarted() ? "started" : "stopped",
  });
});

generalRouter.get("/healthz", (req: Request, res: Response) => {
  let dbConnected = false;
  try {
    getDb();
    dbConnected = true;
  } catch {
    dbConnected = false;
  }

  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: Date.now(),
    database: dbConnected ? "connected" : "disconnected",
    cache: cache.isReady() ? "connected" : "disconnected",
    crons: isCronServiceStarted() ? "started" : "stopped",
  });
});

export { generalRouter };
