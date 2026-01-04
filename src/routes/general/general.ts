import express, { Request, Response } from "express";
import { z } from "zod";

import { config } from "../../config";
import type { AppContext } from "../../context";
import { createMiddleware } from "../middleware";
import { createHealthCheckService } from "../api/health-check/health-check.service";
import { createRankingService } from "../api/rankings/rankings.service";

export function createGeneralRouter(ctx: AppContext) {
  const middleware = createMiddleware(
    ctx.cache,
    ctx.userRepository,
    ctx.mail,
    ctx.helpers,
    ctx.logger,
  );
  const healthCheckService = createHealthCheckService(ctx.cache, ctx.scraper, ctx.logger);
  const rankingService = createRankingService(ctx.scraper);

  const router = express.Router();

  router.get("/", async (req: Request, res: Response) => {
    const rankings = await rankingService.getRankings({
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

      await ctx.mail.sendContactEmail({ name, email, message });

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
    const hostname = ctx.helpers.getHostName(req);
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
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: Date.now(),
      database: "connected",
      cache: ctx.cache.isReady() ? "connected" : "disconnected",
      crons: ctx.cron.getStatus().isRunning ? "started" : "stopped",
    });
  });

  router.get("/healthz", (req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: Date.now(),
      database: "connected",
      cache: ctx.cache.isReady() ? "connected" : "disconnected",
      crons: ctx.cron.getStatus().isRunning ? "started" : "stopped",
    });
  });

  return router;
}
