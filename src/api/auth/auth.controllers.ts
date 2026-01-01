import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import * as UserRepository from "../../db/repositories/user.repository";
import { getGoogleOAuthURL, getHostName, hashKey } from "../../utils/helpers";
import logger from "../../utils/logger";
import {
  resetAPIKey,
  resetAdminAPIKey,
  sendVerificationEmail,
  sendWelcomeEmail,
} from "../../views/views.services";
import { UnauthorizedError } from "../api.errors";
import { ValidationError } from "../api.errors";
import * as AuthServices from "./auth.services";
import { postRegisterType, postResetApiKeyType, postVerifyEmailType } from "./auth.validations";

export async function getGoogle(req: Request, res: Response) {
  res.redirect(getGoogleOAuthURL());
}

export async function getGoogleRedirect(req: Request, res: Response) {
  const code = req.query.code as string;

  if (!code) {
    throw new UnauthorizedError("Something went wrong while authenticating with Google");
  }

  const { id_token, access_token } = await AuthServices.getGoogleOauthToken({ code });

  const googleUser = await AuthServices.getGoogleUser({
    id_token,
    access_token,
  });

  if (!googleUser.verified_email) {
    throw new UnauthorizedError("Something went wrong while authenticating with Google");
  }

  const found = await UserRepository.findByEmail(googleUser.email);

  if (!found) {
    const createdUser = await UserRepository.create({
      email: googleUser.email,
      name: googleUser.name,
      verification_token: access_token,
      verified: true,
      verified_at: new Date().toISOString(),
    });

    sendWelcomeEmail({
      name: createdUser.name,
      email: createdUser.email,
      userId: String(createdUser.id),
    });

    req.flash("success", "We will send you an API key to your email very shortly!");

    return res.redirect("/register");
  }

  req.flash(
    "error",
    "Email already exist, please click on 'Forgot api key?' to request a new one!",
  );

  return res.redirect("/register");
}

export async function postRegister(req: Request<{}, {}, postRegisterType>, res: Response) {
  const { email, name } = req.body;

  const found = await UserRepository.findByEmail(email);

  if (found) {
    throw new ValidationError("email already exist");
  }

  const { key: token } = await hashKey();

  const createdUser = await UserRepository.create({ email, name, verification_token: token });

  const hostname = getHostName(req);

  logger.info(`user_id: ${createdUser.id} has registered an account!`);

  sendVerificationEmail({
    name,
    email,
    verification_token: token,
    hostname,
    userId: String(createdUser.id),
  });

  res.status(StatusCodes.CREATED).json({
    status: "success",
    request_url: req.originalUrl,
    message:
      "Thank you for registering. Please check your email for confirmation or use the follow data to make a post request to /api/auth/verify-email",
    data: [
      {
        email,
        token,
      },
    ],
  });
}

export async function postVerifyEmail(req: Request<{}, {}, postVerifyEmailType>, res: Response) {
  const { token, email } = req.body;

  const foundUser = await UserRepository.findByEmail(email);

  if (!foundUser) {
    throw new ValidationError("Something wrong while verifying your account!");
  }

  if (foundUser.verification_token !== token) {
    throw new ValidationError("Something wrong while verifying your account!");
  }

  if (foundUser.verified === true) {
    throw new ValidationError("This account has already been verified!");
  }

  const unhashedKey = await sendWelcomeEmail({
    name: foundUser.name,
    email: foundUser.email,
    userId: String(foundUser.id),
  });

  res.status(StatusCodes.OK).json({
    status: "success",
    request_url: req.originalUrl,
    message:
      "Thank you for verifying your email address. You can use the following key to access our api or we will send you an API key to your email very shortly!",
    data: [
      {
        email,
        apiKey: unhashedKey,
      },
    ],
  });
}

export async function postResetApiKey(req: Request<{}, {}, postResetApiKeyType>, res: Response) {
  const { email } = req.body;

  const foundUser = await UserRepository.findByEmail(email);

  if (foundUser && foundUser.verified === false) {
    sendVerificationEmail({
      hostname: getHostName(req),
      userId: String(foundUser.id),
      name: foundUser.name,
      email: foundUser.email,
      verification_token: foundUser.verification_token!,
    });
  }

  if (foundUser && foundUser.verified === true && foundUser.admin === true) {
    resetAdminAPIKey({
      userId: String(foundUser.id),
      name: foundUser.name,
      email: foundUser.email,
    });
  } else if (foundUser && foundUser.verified === true) {
    resetAPIKey({ userId: String(foundUser.id), name: foundUser.name, email: foundUser.email });
  }

  res.status(StatusCodes.OK).json({
    status: "success",
    request_url: req.originalUrl,
    message:
      "If you have an account with us, we will send you a new api key to your email very shortly!",
    data: [],
  });
}
