import express, { Request, Response } from "express";
import { z } from "zod";

import { config } from "../../config";
import { Cache } from "../../db/cache";
import { Database } from "../../db/db";
import { CronService } from "../../crons";
import { MailService } from "../../mail";
import { Helpers } from "../../utils/helpers";
import { Middleware } from "../middleware";
import { HealthCheckService } from "../api/health-check/health-check.service";
import { RankingsService } from "../api/rankings/rankings.service";

export function GeneralRouter() {
  const cache = Cache();
  const cronService = CronService();
  const mailService = MailService();
  const helpers = Helpers();
  const middleware = Middleware();
  const healthCheckService = HealthCheckService();
  const rankingsService = RankingsService();

  const router = express.Router();

  router.get("/", async (req: Request, res: Response) => {
    const rankings = await rankingsService.getRankings({
      current_page: 1,
      per_page: 5,
      cache: true,
    });

    return res.status(200).render("general/home.html", {
      path: "/",
      rankings,
    });
  });

  router.get("/about", (req: Request, res: Response) => {
    return res.status(200).render("general/about.html", {
      path: "/about",
      title: "About",
    });
  });

  router.get("/contact", (req: Request, res: Response) => {
    return res.status(200).render("general/contact.html", {
      path: "/contact",
      title: "Contact",
      messages: req.flash(),
    });
  });

  router.post(
    "/contact",
    middleware.validationMiddleware({
      body: z.object({
        email: z.email({ message: "must be valid email address!" }),
        name: z.string({ message: "name is required!" }),
        message: z.string({ message: "message is required!" }),
      }),
    }),
    async (req: Request, res: Response) => {
      const { name, email, message } = req.body;

      await mailService.sendContactEmail({ name, email, message });

      req.flash("info", "Thanks for reaching out to us. We'll get back to you shortly!");

      return res.status(307).redirect("/contact");
    },
  );

  router.get("/terms", (req: Request, res: Response) => {
    return res.status(200).render("general/terms.html", {
      path: "/terms",
      title: "Terms of Service",
    });
  });

  router.get("/privacy", (req: Request, res: Response) => {
    return res.status(200).render("general/privacy.html", {
      path: "/privacy",
      title: "Privacy Policy",
    });
  });

  router.get("/status", async (req: Request, res: Response) => {
    const hostname = helpers.getHostName(req);
    const apiStatuses = await healthCheckService.getAPIStatus({
      X_API_KEY: config.app.xApiKey,
      url: hostname,
    });

    const allGood = apiStatuses.every((item: { status: boolean }) => item.status);

    return res.status(200).render("general/status.html", {
      path: "/status",
      title: "Status",
      apiStatuses,
      allGood,
    });
  });

  router.get("/health-check", (req: Request, res: Response) => {
    let dbConnected = false;
    try {
      Database();
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
      crons: cronService.getStatus().isRunning ? "started" : "stopped",
    });
  });

  router.get("/healthz", (req: Request, res: Response) => {
    let dbConnected = false;
    try {
      Database();
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
      crons: cronService.getStatus().isRunning ? "started" : "stopped",
    });
  });

  return router;
}
