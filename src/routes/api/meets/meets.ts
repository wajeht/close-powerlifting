import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import { errorContent, jsonContent, paginatedResponse, successResponse } from "../api.schemas";
import { createMeetsService } from "./meets.service";
import {
  getMeetHighlightsQueryValidation,
  getMeetParamValidation,
  getMeetQueryValidation,
  listMeetsQueryValidation,
} from "./meets.validation";

const MeetSummary = z.unknown().openapi("MeetSummary");
const MeetDetail = z.unknown().openapi("MeetDetail");
const MeetHighlights = z.unknown().openapi("MeetHighlights");

const listRoute = createRoute({
  method: "get",
  path: "/api/meets",
  request: { query: listMeetsQueryValidation },
  responses: {
    200: { description: "Meet summaries", ...jsonContent(paginatedResponse(MeetSummary)) },
    400: { description: "Validation error", ...errorContent },
    429: { description: "Rate limit exceeded", ...errorContent },
  },
  tags: ["Meets"],
  summary: "List meets across federations",
});

const highlightsRoute = createRoute({
  method: "get",
  path: "/api/meets/{federation}/{date}/{slug}/highlights",
  request: {
    params: getMeetParamValidation,
    query: getMeetHighlightsQueryValidation,
  },
  responses: {
    200: { description: "Best-of rollup", ...jsonContent(successResponse(MeetHighlights)) },
    404: { description: "Meet not found", ...errorContent },
    429: { description: "Rate limit exceeded", ...errorContent },
  },
  tags: ["Meets"],
  summary: "Get meet highlights",
});

const detailRoute = createRoute({
  method: "get",
  path: "/api/meets/{federation}/{date}/{slug}",
  request: {
    params: getMeetParamValidation,
    query: getMeetQueryValidation,
  },
  responses: {
    200: { description: "Meet + results", ...jsonContent(successResponse(MeetDetail)) },
    404: { description: "Meet not found", ...errorContent },
    429: { description: "Rate limit exceeded", ...errorContent },
  },
  tags: ["Meets"],
  summary: "Get meet results",
});

export function createMeetsRouter(context: AppContext) {
  const service = createMeetsService(context.store);
  const app = new OpenAPIHono();

  app.openapi(listRoute, (c) => {
    const query = c.req.valid("query");
    const { data, pagination } = service.listMeets(query);
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

  app.openapi(highlightsRoute, (c) => {
    const params = c.req.valid("param");
    const query = c.req.valid("query");
    const result = service.getMeetHighlights(params, query);
    if (result == null) {
      throw new NotFoundError(
        `Meet "${params.federation}/${params.date}/${params.slug}" not found`,
      );
    }
    return c.json(
      {
        status: "success" as const,
        request_url: c.req.url,
        message: "The resource was returned successfully!",
        data: result,
      },
      200,
    );
  });

  app.openapi(detailRoute, (c) => {
    const params = c.req.valid("param");
    const query = c.req.valid("query");
    const result = service.getMeet(params, query);
    if (result == null) {
      throw new NotFoundError(
        `Meet "${params.federation}/${params.date}/${params.slug}" not found`,
      );
    }
    return c.json(
      {
        status: "success" as const,
        request_url: c.req.url,
        message: "The resource was returned successfully!",
        data: result,
      },
      200,
    );
  });

  return app;
}
