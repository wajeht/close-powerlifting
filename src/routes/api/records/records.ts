import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import type { AppContext } from "../../../context";
import { errorContent, jsonContent, successResponse } from "../api.schemas";
import {
  RecordsData,
  getRecordsByEquipmentParamValidation,
  getRecordsBySexOrWeightClassParamValidation,
  getRecordsByWeightClassSexParamValidation,
  getRecordsQueryValidation,
} from "./records.schema";
import { EQUIPMENT_GROUP_BY_QUERY, SEX_BY_QUERY, createRecordsService } from "./records.service";

export function createRecordsRouter(context: AppContext) {
  const service = createRecordsService(context.store);
  const app = new OpenAPIHono();

  app.openapi(
    createRoute({
      method: "get",
      path: "/api/records",
      request: { query: getRecordsQueryValidation },
      responses: {
        200: { description: "All records", ...jsonContent(successResponse(RecordsData)) },
        400: { description: "Validation error", ...errorContent },
        429: { description: "Rate limit exceeded", ...errorContent },
      },
      tags: ["Records"],
      summary: "Get all powerlifting records",
    }),
    (c) => {
      const { age_class } = c.req.valid("query");
      const data = service.groupRecords({ ageClass: age_class ?? null });
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
      path: "/api/records/{equipment}/{weight_class}/{sex}",
      request: {
        params: getRecordsByWeightClassSexParamValidation,
        query: getRecordsQueryValidation,
      },
      responses: {
        200: { description: "Filtered records", ...jsonContent(successResponse(RecordsData)) },
        400: { description: "Validation error", ...errorContent },
        429: { description: "Rate limit exceeded", ...errorContent },
      },
      tags: ["Records"],
      summary: "Get records filtered by equipment, weight-class system, and sex",
    }),
    (c) => {
      const { equipment, sex } = c.req.valid("param");
      const { age_class } = c.req.valid("query");
      const data = service.groupRecords({
        equipmentGroup: EQUIPMENT_GROUP_BY_QUERY[equipment],
        sex: SEX_BY_QUERY[sex],
        ageClass: age_class ?? null,
      });
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
      path: "/api/records/{equipment}/{sex_or_weight_class}",
      request: {
        params: getRecordsBySexOrWeightClassParamValidation,
        query: getRecordsQueryValidation,
      },
      responses: {
        200: { description: "Filtered records", ...jsonContent(successResponse(RecordsData)) },
        400: { description: "Validation error", ...errorContent },
      },
      tags: ["Records"],
      summary: "Get records filtered by equipment and (sex or weight class)",
    }),
    (c) => {
      const { equipment, sex_or_weight_class } = c.req.valid("param");
      const { age_class } = c.req.valid("query");
      const equipmentGroup = EQUIPMENT_GROUP_BY_QUERY[equipment];
      const resolved = service.resolveSexOrWeightClass(sex_or_weight_class);
      const data = service.groupRecords({
        equipmentGroup,
        sex: resolved?.kind === "sex" ? resolved.value : undefined,
        weightClassKg: resolved?.kind === "weightClass" ? resolved.value : undefined,
        ageClass: age_class ?? null,
      });
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
      path: "/api/records/{equipment}",
      request: {
        params: getRecordsByEquipmentParamValidation,
        query: getRecordsQueryValidation,
      },
      responses: {
        200: { description: "Filtered records", ...jsonContent(successResponse(RecordsData)) },
        400: { description: "Invalid equipment", ...errorContent },
      },
      tags: ["Records"],
      summary: "Get records filtered by equipment type",
    }),
    (c) => {
      const { equipment } = c.req.valid("param");
      const { age_class } = c.req.valid("query");
      const data = service.groupRecords({
        equipmentGroup: EQUIPMENT_GROUP_BY_QUERY[equipment],
        ageClass: age_class ?? null,
      });
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
