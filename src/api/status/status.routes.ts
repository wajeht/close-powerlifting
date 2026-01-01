import express from "express";
import catchAsyncHandler from "express-async-handler";

import { validationMiddleware } from "../api.middlewares";
import { getStatusValidation } from "./status.validations";
import { getStatus } from "./status.controllers";

const status = express.Router();

/**
 * GET /api/status
 * @tags status
 * @summary all things relating status end point
 * @security BearerAuth
 */

status.get("/", validationMiddleware({ query: getStatusValidation }), catchAsyncHandler(getStatus));

export default status;
