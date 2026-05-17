import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";

export function createFederationsRouter(context: AppContext) {
  const router = express.Router();

  router.get("/api/federations", (_req: Request, res: Response) => {
    const data = context.store.get();
    res.json({
      status: "success",
      data: data.federations.map((fed) => ({
        slug: fed.slug,
        code: fed.code,
        parent_slug: fed.parentSlug,
        meet_count: fed.meetCount,
      })),
    });
  });

  router.get("/api/federations/:slug", (req: Request, res: Response) => {
    const data = context.store.get();
    const rawSlug = String(req.params.slug ?? "");
    const slug = rawSlug.toLowerCase();
    const federation = data.federations.find((f) => f.slug === slug);
    if (federation == null) {
      throw new NotFoundError(`Federation "${rawSlug}" not found`);
    }
    const meetIds = data.meetsByFederation.get(slug) ?? [];
    const meets = meetIds
      .map((id) => data.meets[id])
      .filter((m): m is NonNullable<typeof m> => m != null)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((m) => ({
        path: m.path,
        meet_name: m.meetName,
        date: m.date,
        country: m.meetCountry,
        state: m.meetState,
        town: m.meetTown,
        sanctioned: m.sanctioned,
      }));
    res.json({
      status: "success",
      data: {
        slug: federation.slug,
        code: federation.code,
        parent_slug: federation.parentSlug,
        meet_count: federation.meetCount,
        meets,
      },
    });
  });

  return router;
}
