import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { HTTPException } from "hono/http-exception";

import type { AppContext } from "../../../context";
import { errorContent, jsonContent, paginatedResponse, successResponse } from "../api.schemas";
import { createFederationsService } from "./federations.service";
import {
  getFederationMeetsQueryValidation,
  getFederationsParamValidation,
  getFederationsValidation,
} from "./federations.validation";

const FederationRow = z.unknown().openapi("FederationRow");
const FederationDetail = z.unknown().openapi("FederationDetail");
const FederationStats = z.unknown().openapi("FederationStats");

const listRoute = createRoute({
  method: "get",
  path: "/api/federations",
  request: { query: getFederationsValidation },
  responses: {
    200: { description: "Federation rows", ...jsonContent(paginatedResponse(FederationRow)) },
    400: { description: "Validation error", ...errorContent },
    429: { description: "Rate limit exceeded", ...errorContent },
  },
  tags: ["Federations"],
  summary: "Get all federations with optional pagination",
});

const statsRoute = createRoute({
  method: "get",
  path: "/api/federations/{federation}/stats",
  request: { params: getFederationsParamValidation },
  responses: {
    200: {
      description: "Year-bucketed meet counts",
      ...jsonContent(successResponse(FederationStats)),
    },
    404: { description: "Federation not found", ...errorContent },
    429: { description: "Rate limit exceeded", ...errorContent },
  },
  tags: ["Federations"],
  summary: "Get a federation's meet count by year",
});

const detailRoute = createRoute({
  method: "get",
  path: "/api/federations/{federation}",
  request: {
    params: getFederationsParamValidation,
    query: getFederationMeetsQueryValidation,
  },
  responses: {
    200: { description: "Federation + meets", ...jsonContent(successResponse(FederationDetail)) },
    404: { description: "Federation not found", ...errorContent },
    400: { description: "Validation error", ...errorContent },
    429: { description: "Rate limit exceeded", ...errorContent },
  },
  tags: ["Federations"],
  summary: "Get meets for a specific federation",
});

export function createFederationsRouter(context: AppContext) {
  const service = createFederationsService(context.store);
  const app = new OpenAPIHono();

  app.openapi(listRoute, (c) => {
    const query = c.req.valid("query");
    const { data, pagination } = service.getFederations(query);
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

  app.openapi(statsRoute, (c) => {
    const { federation } = c.req.valid("param");
    const stats = service.getFederationStats(federation);
    if (stats == null)
      throw new HTTPException(404, { message: `Federation "${federation}" not found` });
    return c.json(
      {
        status: "success" as const,
        request_url: c.req.url,
        message: "The resource was returned successfully!",
        data: stats,
      },
      200,
    );
  });

  app.openapi(detailRoute, (c) => {
    const { federation } = c.req.valid("param");
    const query = c.req.valid("query");
    const detail = service.getFederation(federation, query);
    if (detail == null)
      throw new HTTPException(404, { message: `Federation "${federation}" not found` });
    return c.json(
      {
        status: "success" as const,
        request_url: c.req.url,
        message: "The resource was returned successfully!",
        data: detail,
      },
      200,
    );
  });

  return app;
}
