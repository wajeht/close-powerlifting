import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import { paginate, sendSuccess } from "../api.helpers";
import {
  getFederationMeetsQueryValidation,
  getFederationsParamValidation,
  getFederationsValidation,
} from "./federations.validation";

export function createFederationsRouter(context: AppContext) {
  const router = express.Router();

  /**
   * GET /api/federations
   * @summary Get all federations with optional pagination
   * @tags Federations
   */
  router.get("/api/federations", (req: Request, res: Response) => {
    const data = context.store.get();
    const query = getFederationsValidation.parse(req.query);

    const rows = data.federations.map((fed) => ({
      slug: fed.slug,
      code: fed.code,
      parent_slug: fed.parentSlug,
      meet_count: fed.meetCount,
    }));
    const { slice, pagination } = paginate(rows, query.current_page, query.per_page);
    sendSuccess(res, slice, { requestUrl: req.originalUrl, pagination });
  });

  /**
   * GET /api/federations/{federation}/stats
   * @summary Get a federation's meet count by year
   * @tags Federations
   */
  router.get("/api/federations/:federation/stats", (req: Request, res: Response) => {
    const data = context.store.get();
    const { federation: rawSlug } = getFederationsParamValidation.parse(req.params);
    const slug = rawSlug.toLowerCase();
    const fed = data.federations.find((f) => f.slug === slug);
    if (fed == null) throw new NotFoundError(`Federation "${rawSlug}" not found`);

    const meetIds = data.meetsByFederation.get(slug) ?? [];
    const byYear = new Map<number, number>();
    for (const id of meetIds) {
      const year = parseInt(data.meets[id]!.date.slice(0, 4), 10);
      if (!Number.isFinite(year)) continue;
      byYear.set(year, (byYear.get(year) ?? 0) + 1);
    }
    const stats = Array.from(byYear, ([year, meet_count]) => ({ year, meet_count })).sort(
      (a, b) => b.year - a.year,
    );

    sendSuccess(
      res,
      {
        slug: fed.slug,
        code: fed.code,
        parent_slug: fed.parentSlug,
        total_meets: fed.meetCount,
        meets_by_year: stats,
      },
      { requestUrl: req.originalUrl },
    );
  });

  /**
   * GET /api/federations/{federation}
   * @summary Get meets for a specific federation
   * @tags Federations
   * @param {number} year.query - Filter meets to a single year
   */
  router.get("/api/federations/:federation", (req: Request, res: Response) => {
    const data = context.store.get();
    const { federation: rawSlug } = getFederationsParamValidation.parse(req.params);
    const { year } = getFederationMeetsQueryValidation.parse(req.query);
    const slug = rawSlug.toLowerCase();
    const fed = data.federations.find((f) => f.slug === slug);
    if (fed == null) throw new NotFoundError(`Federation "${rawSlug}" not found`);

    const meetIds = data.meetsByFederation.get(slug) ?? [];
    let meets = meetIds.map((id) => data.meets[id]!).sort((a, b) => b.date.localeCompare(a.date));
    if (year != null) {
      const prefix = `${year}-`;
      meets = meets.filter((m) => m.date.startsWith(prefix));
    }

    sendSuccess(
      res,
      {
        slug: fed.slug,
        code: fed.code,
        parent_slug: fed.parentSlug,
        meet_count: meets.length,
        meets: meets.map((m) => ({
          path: m.path,
          meet_name: m.meetName,
          date: m.date,
          country: m.meetCountry,
          state: m.meetState,
          town: m.meetTown,
          sanctioned: m.sanctioned,
        })),
      },
      { requestUrl: req.originalUrl },
    );
  });

  return router;
}
