import express from "express";
import catchAsyncHandler from "express-async-handler";

import { validationMiddleware } from "../api.middlewares";
import { getMeet } from "./meets.controllers";
import { getMeetParamValidation, getMeetQueryValidation } from "./meets.validations";

const meets = express.Router();

/**
 * GET /api/meets/{meet}?cache={cache}
 * @tags meets
 * @summary get specific detail of a meet
 * @param {string} meet.path.required - the meet - application/x-www-form-urlencoded
 * @param {boolean} cache.query - the cache - application/x-www-form-urlencoded
 * @security BearerAuth
 */

/**
 * GET /api/meets/{meet}
 * @tags meets
 * @summary get specific detail of a meet
 * @param {string} meet.path.required - the meet - application/x-www-form-urlencoded
 * @security BearerAuth
 */
meets.get(
  "/:meet",
  validationMiddleware({
    params: getMeetParamValidation,
    query: getMeetQueryValidation,
  }),
  catchAsyncHandler(getMeet),
);

export default meets;
