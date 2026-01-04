import express, { Request, Response } from "express";
import { z } from "zod";

import { configuration } from "../../configuration";
import type { AppContext } from "../../context";
import { createMiddleware } from "../middleware";
import { createHealthCheckService } from "../api/health-check/health-check.service";
import { createRankingService } from "../api/rankings/rankings.service";

export function createGeneralRouter(context: AppContext) {
  const middleware = createMiddleware(
    context.cache,
    context.userRepository,
    context.mail,
    context.helpers,
    context.logger,
  );
  const healthCheckService = createHealthCheckService(
    context.cache,
    context.scraper,
    context.logger,
  );
  const rankingService = createRankingService(context.scraper);

  const router = express.Router();

  router.get("/", async (req: Request, res: Response) => {
    const rankings = await rankingService.getRankings({
      current_page: 1,
      per_page: 5,
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

      await context.mail.sendContactEmail({ name, email, message });

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
    const hostname = context.helpers.getHostName(req);
    const apiStatuses = await healthCheckService.getAPIStatus({
      X_API_KEY: configuration.app.xApiKey,
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
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: Date.now(),
      database: "connected",
      cache: context.cache.isReady() ? "connected" : "disconnected",
      crons: context.cron.getStatus().isRunning ? "started" : "stopped",
    });
  });

  router.get("/healthz", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: Date.now(),
      database: "connected",
      cache: context.cache.isReady() ? "connected" : "disconnected",
      crons: context.cron.getStatus().isRunning ? "started" : "stopped",
    });
  });

  return router;
}
