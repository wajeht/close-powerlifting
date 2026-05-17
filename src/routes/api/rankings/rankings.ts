import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { HTTPException } from "hono/http-exception";

import type { AppContext } from "../../../context";
import { errorContent, jsonContent, paginatedResponse, successResponse } from "../api.schemas";
import { createRankingsService } from "./rankings.service";
import {
  getFilteredRankingsParamValidation,
  getFilteredRankingsQueryValidation,
  getRankValidation,
  getRankingsValidation,
} from "./rankings.validation";

const RankingEntry = z.unknown().openapi("RankingEntry");

const indexRoute = createRoute({
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
});

const byRankRoute = createRoute({
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
});

// Build a createRoute for each cumulative-filter depth. Each variant
// declares only the params that appear in its path; the service does
// the conditional narrowing.
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

const filter6 = filterRouteShape(
  "/api/rankings/filter/{equipment}/{sex}/{weight_class}/{year}/{event}/{sort}",
  ["equipment", "sex", "weight_class", "year", "event", "sort"],
);
const filter5 = filterRouteShape(
  "/api/rankings/filter/{equipment}/{sex}/{weight_class}/{year}/{event}",
  ["equipment", "sex", "weight_class", "year", "event"],
);
const filter4 = filterRouteShape("/api/rankings/filter/{equipment}/{sex}/{weight_class}/{year}", [
  "equipment",
  "sex",
  "weight_class",
  "year",
]);
const filter3 = filterRouteShape("/api/rankings/filter/{equipment}/{sex}/{weight_class}", [
  "equipment",
  "sex",
  "weight_class",
]);
const filter2 = filterRouteShape("/api/rankings/filter/{equipment}/{sex}", ["equipment", "sex"]);
const filter1 = filterRouteShape("/api/rankings/filter/{equipment}", ["equipment"]);

export function createRankingsRouter(context: AppContext) {
  const service = createRankingsService(context.store);
  const app = new OpenAPIHono();

  app.openapi(indexRoute, (c) => {
    const query = c.req.valid("query");
    const { data, pagination } = service.getRankings(query);
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

  for (const route of [filter6, filter5, filter4, filter3, filter2, filter1]) {
    app.openapi(route, (c) => {
      const params = c.req.valid("param") as z.infer<typeof getFilteredRankingsParamValidation>;
      const query = c.req.valid("query");
      const { data, pagination } = service.getFilteredRankings(params, query);
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

  app.openapi(byRankRoute, (c) => {
    const { rank: rawRank } = c.req.valid("param");
    const rank = parseInt(rawRank, 10);
    const data = service.getRank(rank);
    if (data == null) {
      throw new HTTPException(404, {
        message: `Rank ${rawRank} is out of range (max=${service.getMaxRank()})`,
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
  });

  return app;
}
