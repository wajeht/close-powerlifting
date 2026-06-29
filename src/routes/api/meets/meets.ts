import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { AppContext } from "../../../context";
import { errorContent, jsonContent, paginatedResponse, successResponse } from "../api.schemas";
import {
  MeetDetail,
  MeetHighlights,
  MeetSummary,
  getMeetHighlightsQueryValidation,
  getMeetParamValidation,
  getMeetQueryValidation,
  listMeetsQueryValidation,
} from "./meets.schema";
import { createMeetsService } from "./meets.service";

export function createMeetsRouter(context: AppContext) {
  const service = createMeetsService(context.store);
  const app = new OpenAPIHono();

  app.openapi(
    createRoute({
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
    }),
    async (c) => {
      const query = c.req.valid("query");
      const { data, pagination } = await service.listMeets(query);
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

  app.openapi(
    createRoute({
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
    }),
    async (c) => {
      const params = c.req.valid("param");
      const query = c.req.valid("query");
      const result = await service.getMeetHighlights(params, query);
      if (result == null) {
        throw new HTTPException(404, {
          message: `Meet "${params.federation}/${params.date}/${params.slug}" not found`,
        });
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
    },
  );

  app.openapi(
    createRoute({
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
    }),
    async (c) => {
      const params = c.req.valid("param");
      const query = c.req.valid("query");
      const result = await service.getMeet(params, query);
      if (result == null) {
        throw new HTTPException(404, {
          message: `Meet "${params.federation}/${params.date}/${params.slug}" not found`,
        });
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
    },
  );

  return app;
}
