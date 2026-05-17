import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { EQUIPMENT_GROUP_BY_QUERY, SEX_BY_QUERY, createRecordsService } from "./records.service";
import {
  getRecordsByEquipmentParamValidation,
  getRecordsBySexOrWeightClassParamValidation,
  getRecordsByWeightClassSexParamValidation,
  getRecordsQueryValidation,
} from "./records.validation";

export function createRecordsRouter(context: AppContext) {
  const recordsService = createRecordsService(context.store);
  const router = express.Router();

  /**
   * GET /api/records
   * @tags Records
   * @summary Get all powerlifting records
   */
  router.get("/api/records", (req: Request, res: Response) => {
    const { age_class } = getRecordsQueryValidation.parse(req.query);
    const data = recordsService.groupRecords({ ageClass: age_class ?? null });
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
    });
  });

  /**
   * GET /api/records/{equipment}/{weight_class}/{sex}
   * @tags Records
   * @summary Get records filtered by equipment, weight class system, and sex
   */
  router.get("/api/records/:equipment/:weight_class/:sex", (req: Request, res: Response) => {
    const { equipment, sex } = getRecordsByWeightClassSexParamValidation.parse(req.params);
    const { age_class } = getRecordsQueryValidation.parse(req.query);
    const data = recordsService.groupRecords({
      equipmentGroup: EQUIPMENT_GROUP_BY_QUERY[equipment],
      sex: SEX_BY_QUERY[sex],
      ageClass: age_class ?? null,
    });
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
    });
  });

  /**
   * GET /api/records/{equipment}/{sex_or_weight_class}
   * @tags Records
   * @summary Get records filtered by equipment and (sex or weight class)
   */
  router.get("/api/records/:equipment/:sex_or_weight_class", (req: Request, res: Response) => {
    const { equipment, sex_or_weight_class } = getRecordsBySexOrWeightClassParamValidation.parse(
      req.params,
    );
    const { age_class } = getRecordsQueryValidation.parse(req.query);
    const equipmentGroup = EQUIPMENT_GROUP_BY_QUERY[equipment];
    const resolved = recordsService.resolveSexOrWeightClass(sex_or_weight_class);
    const data = recordsService.groupRecords({
      equipmentGroup,
      sex: resolved?.kind === "sex" ? resolved.value : undefined,
      weightClassKg: resolved?.kind === "weightClass" ? resolved.value : undefined,
      ageClass: age_class ?? null,
    });
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
    });
  });

  /**
   * GET /api/records/{equipment}
   * @tags Records
   * @summary Get records filtered by equipment type
   */
  router.get("/api/records/:equipment", (req: Request, res: Response) => {
    const { equipment } = getRecordsByEquipmentParamValidation.parse(req.params);
    const { age_class } = getRecordsQueryValidation.parse(req.query);
    const data = recordsService.groupRecords({
      equipmentGroup: EQUIPMENT_GROUP_BY_QUERY[equipment],
      ageClass: age_class ?? null,
    });
    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message: "The resource was returned successfully!",
      data,
    });
  });

  return router;
}
