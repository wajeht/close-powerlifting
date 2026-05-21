import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import type { AppContext } from "../../../context";
import type { Units } from "../../../utils/helpers";
import { errorContent, jsonContent, successResponse } from "../api.schemas";
import {
  CompareData,
  PersonalBests,
  Progression,
  UserListData,
  UserProfile,
  UserRank,
  getCompareValidation,
  getUserParamValidation,
  getUserQueryValidation,
  getUsersValidation,
  userUnitsQueryValidation,
} from "./users.schema";
import { createUsersService } from "./users.service";

export function createUsersRouter(context: AppContext) {
  const service = createUsersService(context.store);
  const app = new OpenAPIHono();

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/users",
      request: { query: getUsersValidation },
      responses: {
        200: {
          description: "Paginated list of lifters (optionally filtered by ?search=)",
          ...jsonContent(successResponse(UserListData)),
        },
        400: { description: "Validation error", ...errorContent },
        429: { description: "Rate limit exceeded", ...errorContent },
      },
      tags: ["Users"],
      summary: "List lifters (paginated, optional case-insensitive ?search=)",
    }),
    (c) => {
      const query = c.req.valid("query");
      const { data, pagination } = service.listLifters(query);
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
      path: "/api/users/compare",
      request: { query: getCompareValidation },
      responses: {
        200: {
          description: "Side-by-side comparison",
          ...jsonContent(successResponse(CompareData)),
        },
        400: { description: "Validation error", ...errorContent },
        404: { description: "Lifter not found", ...errorContent },
        429: { description: "Rate limit exceeded", ...errorContent },
      },
      tags: ["Users"],
      summary: "Compare two athletes side-by-side",
    }),
    (c) => {
      const query = c.req.valid("query");
      const result = service.compare(query);
      if (!result.found) {
        const missing = result.missing === "a" ? query.a : query.b;
        throw new HTTPException(404, { message: `Lifter "${missing}" not found` });
      }
      return c.json(
        {
          status: "success" as const,
          request_url: c.req.url,
          message: "The resource was returned successfully!",
          data: result.data,
        },
        200,
      );
    },
  );

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/users/{username}/progression",
      request: {
        params: getUserParamValidation,
        query: userUnitsQueryValidation,
      },
      responses: {
        200: {
          description: "Chronological progression",
          ...jsonContent(successResponse(Progression)),
        },
        404: { description: "Lifter not found", ...errorContent },
      },
      tags: ["Users"],
      summary: "Get an athlete's competition progression over time",
    }),
    (c) => {
      const { username } = c.req.valid("param");
      const { units = "lbs" } = c.req.valid("query");
      const data = service.getProgression(username, units as Units);
      if (data == null) throw new HTTPException(404, { message: `Lifter "${username}" not found` });
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

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/users/{username}/personal-bests",
      request: {
        params: getUserParamValidation,
        query: userUnitsQueryValidation,
      },
      responses: {
        200: { description: "PBs by equipment", ...jsonContent(successResponse(PersonalBests)) },
        404: { description: "Lifter not found", ...errorContent },
      },
      tags: ["Users"],
      summary: "Get an athlete's personal bests grouped by equipment",
    }),
    (c) => {
      const { username } = c.req.valid("param");
      const { units = "lbs" } = c.req.valid("query");
      const data = service.getPersonalBests(username, units as Units);
      if (data == null) throw new HTTPException(404, { message: `Lifter "${username}" not found` });
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

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/users/{username}/rank",
      request: { params: getUserParamValidation },
      responses: {
        200: { description: "Per-metric ranks", ...jsonContent(successResponse(UserRank)) },
        404: { description: "Lifter not found", ...errorContent },
      },
      tags: ["Users"],
      summary: "Get an athlete's global ranking",
    }),
    (c) => {
      const { username } = c.req.valid("param");
      const data = service.getRank(username);
      if (data == null) throw new HTTPException(404, { message: `Lifter "${username}" not found` });
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

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/users/{username}",
      request: {
        params: getUserParamValidation,
        query: getUserQueryValidation,
      },
      responses: {
        200: {
          description: "Profile + competition history",
          ...jsonContent(successResponse(UserProfile)),
        },
        404: { description: "Lifter not found", ...errorContent },
        429: { description: "Rate limit exceeded", ...errorContent },
      },
      tags: ["Users"],
      summary: "Get athlete profile by username",
    }),
    (c) => {
      const { username } = c.req.valid("param");
      const query = c.req.valid("query");
      const data = service.getUser(username, query);
      if (data == null) throw new HTTPException(404, { message: `Lifter "${username}" not found` });
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
