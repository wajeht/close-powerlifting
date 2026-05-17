import express, { Request, Response } from "express";

import type { AppContext } from "../../../context";
import { EQUIPMENT_GROUP_BY_QUERY, SEX_BY_QUERY, createRecordsService } from "./records.service";
import {
  getRecordsByEquipmentParamValidation,
  getRecordsBySexOrWeightClassParamValidation,
  getRecordsByWeightClassSexParamValidation,
  getRecordsQueryValidation,
} from "./records.validation";

/**
 * One top-3 record row
 * @typedef {object} WeightClassRecord
 * @property {number} weight_class_kg - Weight class (kg). Negative = under-class encoding.
 * @property {number} rank - 1, 2, or 3 within the class
 * @property {number} lift_value - Lifted kg (raw — records are not unit-converted)
 * @property {string} username - Lifter username slug
 * @property {string} name - Lifter name
 * @property {string} federation - Federation code
 * @property {string} meet_path - Canonical meet path
 * @property {string} meet_name - Meet name
 * @property {string} date - ISO 8601 date
 */

/**
 * A subsection grouping records by sex + equipment_group within one category
 * @typedef {object} RecordsSection
 * @property {string} sex - "M" or "F"
 * @property {string} equipment_group - One of raw, wraps, single, multi, unlimited, all-tested
 * @property {WeightClassRecord[]} records - Top-3 per weight class, sorted by class then rank
 */

/**
 * One record category bucket
 * @typedef {object} RecordsCategory
 * @property {string} key - squat_full_power / squat_all_events / bench_full_power / bench_all_events / deadlift_full_power / deadlift_all_events / total
 * @property {string} title - Human-readable title (e.g. "Squat (Full Power)")
 * @property {RecordsSection[]} sections - Sex+equipment groupings within this category
 */

/**
 * Records payload
 * @typedef {object} RecordsData
 * @property {object} filters - Echoes the filter selectors that produced this view
 * @property {RecordsCategory[]} categories - Seven categories, fixed order
 */

/**
 * Records response
 * @typedef {object} RecordsResponse
 * @property {string} status - Response status (success)
 * @property {string} request_url - Request URL
 * @property {string} message - Response message
 * @property {RecordsData} data - Records grouped by category / sex / equipment
 */

/**
 * Error response
 * @typedef {object} ErrorResponse
 * @property {string} status - Response status (fail)
 * @property {string} request_url - Request URL
 * @property {string} message - Error message
 * @property {object[]} errors - Error details
 * @property {object[]} data - Empty array
 */

export function createRecordsRouter(context: AppContext) {
  const recordsService = createRecordsService(context.store);
  const router = express.Router();

  /**
   * GET /api/records
   * @tags Records
   * @summary Get all powerlifting records
   * @description Returns the top-3 lifter per weight class across every category (squat / bench / deadlift / total), broken out by sex and equipment group. `?age_class=` switches to a slower path that re-buckets the raw entries; without it, the precomputed table is returned in under 5 ms.
   * @param {string} age_class.query - Age class filter (e.g. "24-34", "40-44") - enum:5-12,13-15,16-17,18-19,20-23,24-34,35-39,40-44,45-49,50-54,55-59,60-64,65-69,70-74,75-79,80-84,85-89,40-49,50-59,60-69,70-79,over80
   * @return {RecordsResponse} 200 - All records
   * @return {ErrorResponse} 400 - Validation error
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/records",
   *   "message": "The resource was returned successfully!",
   *   "data": {
   *     "filters": { "equipment_group": null, "sex": null, "weight_class_kg": null, "age_class": null },
   *     "categories": [
   *       { "key": "squat_full_power", "title": "Squat (Full Power)", "sections": [
   *         { "sex": "M", "equipment_group": "raw", "records": [
   *           { "weight_class_kg": 100, "rank": 1, "lift_value": 387.5, "username": "tylerwilliamson", "name": "Tyler Williamson", "federation": "SPF", "meet_path": "spf/2025-03-15/texasironrepublic", "meet_name": "Texas Iron Republic", "date": "2025-03-15" }
   *         ]}
   *       ]}
   *     ]
   *   }
   * }
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
   * @summary Get records filtered by equipment, weight-class system, and sex
   * @description Three-part filter. `weight_class` here is a class-system selector (ipf-classes / expanded-classes / wp-classes / para-classes) — its value is echoed back in the `filters` block but does not narrow the dataset (we group on raw kg values).
   * @param {string} equipment.path.required - Equipment group - enum:raw,wraps,single,multi,unlimited,all-tested
   * @param {string} weight_class.path.required - Weight-class system - enum:expanded-classes,ipf-classes,para-classes,wp-classes
   * @param {string} sex.path.required - Sex - enum:men,women
   * @param {string} age_class.query - Age class filter
   * @return {RecordsResponse} 200 - Filtered records
   * @return {ErrorResponse} 400 - Validation error
   * @return {ErrorResponse} 429 - Rate limit exceeded
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/records/raw/ipf-classes/men",
   *   "message": "The resource was returned successfully!",
   *   "data": { "filters": { "equipment_group": "raw", "sex": "M", "weight_class_kg": null, "age_class": null }, "categories": [] }
   * }
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
   * @description Two-part filter. The second segment is interpreted as a sex if it's "men" / "women", or as a numeric weight class (kg) otherwise — anything else falls back to just the equipment filter.
   * @param {string} equipment.path.required - Equipment group - enum:raw,wraps,single,multi,unlimited,all-tested
   * @param {string} sex_or_weight_class.path.required - Either "men"/"women" or a weight class like "82.5"
   * @param {string} age_class.query - Age class filter
   * @return {RecordsResponse} 200 - Filtered records
   * @return {ErrorResponse} 400 - Validation error
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/records/raw/women",
   *   "message": "The resource was returned successfully!",
   *   "data": { "filters": { "equipment_group": "raw", "sex": "F", "weight_class_kg": null, "age_class": null }, "categories": [] }
   * }
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
   * @description Returns top-3 across all categories for one equipment group only.
   * @param {string} equipment.path.required - Equipment group - enum:raw,wraps,single,multi,unlimited,all-tested
   * @param {string} age_class.query - Age class filter
   * @return {RecordsResponse} 200 - Filtered records
   * @return {ErrorResponse} 400 - Invalid equipment
   * @example response - 200 - Success response
   * {
   *   "status": "success",
   *   "request_url": "/api/records/raw",
   *   "message": "The resource was returned successfully!",
   *   "data": { "filters": { "equipment_group": "raw", "sex": null, "weight_class_kg": null, "age_class": null }, "categories": [] }
   * }
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
