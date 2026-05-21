import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { AppContext } from "../../../context";
import { errorContent, jsonContent, successResponse } from "../api.schemas";
import { createHealthCheckService } from "./health-check.service";

const HealthCheckData = z
  .object({
    uptime: z.number(),
    timestamp: z.number(),
    data: z.enum(["ready", "loading"]),
  })
  .openapi("HealthCheckData");

export function createHealthCheckRouter(context: AppContext) {
  const service = createHealthCheckService(context.store);
  const app = new OpenAPIHono();

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/health-check",
      responses: {
        200: {
          description: "API is healthy and the data store is ready",
          ...jsonContent(successResponse(HealthCheckData)),
        },
        503: { description: "Snapshot still loading", ...errorContent },
      },
      tags: ["Health Check"],
      summary: "Check API health status",
      description:
        "Readiness probe. Returns 200 once the snapshot is ready, 503 while startup is still preparing data. Anonymous and unmetered — safe to call from load balancers and uptime monitors.",
    }),
    (c) => {
      if (!service.isReady()) {
        return c.json(
          {
            status: "fail" as const,
            request_url: c.req.url,
            message: "Data is still loading",
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
          data: service.getHealthCheck(),
        },
        200,
      );
    },
  );

  return app;
}
