import catchAsyncHandler from 'express-async-handler';
import { validate } from '../api.middlewares';

import * as UsersControllers from './users.controllers';
import * as UsersValidation from './users.validations';

import express from 'express';
const users = express.Router();

/**
 * GET /api/users/{username}
 * @tags users
 * @summary all things relating users end point
 * @param {string} username.params.required - the username - application/x-www-form-urlencoded
 * @security BearerAuth
 */
users.get(
  '/:username',
  validate({ params: UsersValidation.getUserValidation }),
  catchAsyncHandler(UsersControllers.getUser),
);

/**
 * GET /api/users?search={search}
 * @tags users
 * @summary search a user
 * @param {string} search.query.required - the search - application/x-www-form-urlencoded
 * @security BearerAuth
 */
users.get(
  '/',
  validate({ params: UsersValidation.getUsersValidation }),
  catchAsyncHandler(UsersControllers.getUsers),
);

export default users;
