import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { AppContext } from "../../../context";
import { errorContent, jsonContent, successResponse } from "../api.schemas";
import { createStatusService } from "./status.service";

const StatusData = z
  .object({
    lifters: z.number(),
    meets: z.number(),
    entries: z.number(),
    federations: z.number(),
    records: z.number(),
    source_last_modified: z.string().nullable(),
    ingested_at: z.string().nullable(),
  })
  .openapi("StatusData");

export function createStatusRouter(context: AppContext) {
  const service = createStatusService(context.store);
  const app = new OpenAPIHono();

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/status",
      responses: {
        200: {
          description: "Snapshot metadata + counts",
          ...jsonContent(successResponse(StatusData)),
        },
        503: { description: "Snapshot still loading", ...errorContent },
      },
      tags: ["Status"],
      summary: "Get data source status and statistics",
      description:
        "Returns counts of every entity in the loaded snapshot plus the upstream `Last-Modified` header from the OpenPowerlifting bulk CSV that produced it.",
    }),
    (c) => {
      const data = service.getStatus();
      if (data == null) {
        return c.json(
          {
            status: "fail" as const,
            request_url: c.req.url,
            message: "Data is still warming up",
            errors: [],
            data: [],
          },
          503,
        );
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
