import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { AppContext } from "../../../context";
import { errorContent, jsonContent, paginatedResponse, successResponse } from "../api.schemas";
import {
  RankingEntry,
  getFilteredRankingsParamValidation,
  getFilteredRankingsQueryValidation,
  getRankValidation,
  getRankingsValidation,
} from "./rankings.schema";
import { createRankingsService } from "./rankings.service";

// The 6 cumulative-filter routes share an identical createRoute shape modulo
// which path params they declare — keep this helper to avoid 6x duplication.
const filterRouteShape = (path: string, paramKeys: ReadonlyArray<string>) =>
  createRoute({
    method: "get",
    path,
    request: {
      params: getFilteredRankingsParamValidation.pick(
        Object.fromEntries(paramKeys.map((k) => [k, true])) as never,
      ),
      query: getFilteredRankingsQueryValidation,
    },
    responses: {
      200: { description: "Filtered rankings", ...jsonContent(paginatedResponse(RankingEntry)) },
      400: { description: "Validation error", ...errorContent },
    },
    tags: ["Rankings"],
    summary: `Filter rankings by ${paramKeys.join(", ")}`,
  });

export function createRankingsRouter(context: AppContext) {
  const service = createRankingsService(context.store);
  const app = new OpenAPIHono();

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/rankings",
      request: { query: getRankingsValidation },
      responses: {
        200: { description: "Rankings list", ...jsonContent(paginatedResponse(RankingEntry)) },
        400: { description: "Validation error", ...errorContent },
        429: { description: "Rate limit exceeded", ...errorContent },
      },
      tags: ["Rankings"],
      summary: "Get all rankings with optional pagination",
    }),
    async (c) => {
      const query = c.req.valid("query");
      const { data, pagination } = await service.getRankings(query);
      return c.json(
        {
          status: "success" as const,
          request_url: c.req.url,
          message: "The resource was returned successfully!",
          data,
          pagination,
        },
        200,
      );
    },
  );

  const filterRoutes = [
    filterRouteShape(
      "/api/rankings/filter/{equipment}/{sex}/{weight_class}/{year}/{event}/{sort}",
      ["equipment", "sex", "weight_class", "year", "event", "sort"],
    ),
    filterRouteShape("/api/rankings/filter/{equipment}/{sex}/{weight_class}/{year}/{event}", [
      "equipment",
      "sex",
      "weight_class",
      "year",
      "event",
    ]),
    filterRouteShape("/api/rankings/filter/{equipment}/{sex}/{weight_class}/{year}", [
      "equipment",
      "sex",
      "weight_class",
      "year",
    ]),
    filterRouteShape("/api/rankings/filter/{equipment}/{sex}/{weight_class}", [
      "equipment",
      "sex",
      "weight_class",
    ]),
    filterRouteShape("/api/rankings/filter/{equipment}/{sex}", ["equipment", "sex"]),
    filterRouteShape("/api/rankings/filter/{equipment}", ["equipment"]),
  ];

  for (const route of filterRoutes) {
    app.openapi(route, async (c) => {
      const params = c.req.valid("param") as z.infer<typeof getFilteredRankingsParamValidation>;
      const query = c.req.valid("query");
      const { data, pagination } = await service.getFilteredRankings(params, query);
      return c.json(
        {
          status: "success" as const,
          request_url: c.req.url,
          message: "The resource was returned successfully!",
          data,
          pagination,
        },
        200,
      );
    });
  }

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/rankings/{rank}",
      request: { params: getRankValidation },
      responses: {
        200: { description: "Single ranking entry", ...jsonContent(successResponse(RankingEntry)) },
        400: { description: "Validation error", ...errorContent },
        404: { description: "Rank out of range", ...errorContent },
        429: { description: "Rate limit exceeded", ...errorContent },
      },
      tags: ["Rankings"],
      summary: "Get a single ranking by position",
    }),
    async (c) => {
      const { rank: rawRank } = c.req.valid("param");
      const rank = parseInt(rawRank, 10);
      const data = await service.getRank(rank);
      if (data == null) {
        const maxRank = await service.getMaxRank();
        throw new HTTPException(404, {
          message: `Rank ${rawRank} is out of range (max=${maxRank})`,
        });
      }
      return c.json(
        {
          status: "success" as const,
          request_url: c.req.url,
          message: "The resource was returned successfully!",
          data,
        },
        200,
      );
    },
  );

  return app;
}
