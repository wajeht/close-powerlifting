import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import type { AppContext } from "../../../context";
import { NotFoundError } from "../../../error";
import type { Units } from "../../../utils/helpers";
import { errorContent, jsonContent, successResponse } from "../api.schemas";
import { createUsersService } from "./users.service";
import {
  getCompareValidation,
  getUserParamValidation,
  getUserQueryValidation,
  getUsersValidation,
  userUnitsQueryValidation,
} from "./users.validation";

const UserListData = z.unknown().openapi("UserListData");
const UserProfile = z.unknown().openapi("UserProfile");
const PersonalBests = z.unknown().openapi("PersonalBestsByEquipment");
const Progression = z.unknown().openapi("ProgressionData");
const UserRank = z.unknown().openapi("UserRank");
const CompareData = z.unknown().openapi("CompareData");

const searchRoute = createRoute({
  method: "get",
  path: "/api/users",
  request: { query: getUsersValidation },
  responses: {
    200: { description: "Search hits or summary", ...jsonContent(successResponse(UserListData)) },
    400: { description: "Validation error", ...errorContent },
    429: { description: "Rate limit exceeded", ...errorContent },
  },
  tags: ["Users"],
  summary: "Search for athletes or return total lifter count",
});

const compareRoute = createRoute({
  method: "get",
  path: "/api/users/compare",
  request: { query: getCompareValidation },
  responses: {
    200: { description: "Side-by-side comparison", ...jsonContent(successResponse(CompareData)) },
    400: { description: "Validation error", ...errorContent },
    404: { description: "Lifter not found", ...errorContent },
    429: { description: "Rate limit exceeded", ...errorContent },
  },
  tags: ["Users"],
  summary: "Compare two athletes side-by-side",
});

const progressionRoute = createRoute({
  method: "get",
  path: "/api/users/{username}/progression",
  request: {
    params: getUserParamValidation,
    query: userUnitsQueryValidation,
  },
  responses: {
    200: { description: "Chronological progression", ...jsonContent(successResponse(Progression)) },
    404: { description: "Lifter not found", ...errorContent },
  },
  tags: ["Users"],
  summary: "Get an athlete's competition progression over time",
});

const personalBestsRoute = createRoute({
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
});

const rankRoute = createRoute({
  method: "get",
  path: "/api/users/{username}/rank",
  request: { params: getUserParamValidation },
  responses: {
    200: { description: "Per-metric ranks", ...jsonContent(successResponse(UserRank)) },
    404: { description: "Lifter not found", ...errorContent },
  },
  tags: ["Users"],
  summary: "Get an athlete's global ranking",
});

const profileRoute = createRoute({
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
});

export function createUsersRouter(context: AppContext) {
  const service = createUsersService(context.store);
  const app = new OpenAPIHono();

  app.openapi(searchRoute, (c) => {
    const query = c.req.valid("query");
    const { data, pagination } = service.searchOrSummary(query);
    return c.json(
      {
        status: "success" as const,
        request_url: c.req.url,
        message: "The resource was returned successfully!",
        data,
        ...(pagination ? { pagination } : {}),
      },
      200,
    );
  });

  app.openapi(compareRoute, (c) => {
    const query = c.req.valid("query");
    const result = service.compare(query);
    if (!result.found) {
      const missing = result.missing === "a" ? query.a : query.b;
      throw new NotFoundError(`Lifter "${missing}" not found`);
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
  });

  app.openapi(progressionRoute, (c) => {
    const { username } = c.req.valid("param");
    const { units = "lbs" } = c.req.valid("query");
    const data = service.getProgression(username, units as Units);
    if (data == null) throw new NotFoundError(`Lifter "${username}" not found`);
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

  app.openapi(personalBestsRoute, (c) => {
    const { username } = c.req.valid("param");
    const { units = "lbs" } = c.req.valid("query");
    const data = service.getPersonalBests(username, units as Units);
    if (data == null) throw new NotFoundError(`Lifter "${username}" not found`);
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

  app.openapi(rankRoute, (c) => {
    const { username } = c.req.valid("param");
    const data = service.getRank(username);
    if (data == null) throw new NotFoundError(`Lifter "${username}" not found`);
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

  app.openapi(profileRoute, (c) => {
    const { username } = c.req.valid("param");
    const query = c.req.valid("query");
    const data = service.getUser(username, query);
    if (data == null) throw new NotFoundError(`Lifter "${username}" not found`);
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
