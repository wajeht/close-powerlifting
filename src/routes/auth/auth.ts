import express, { Request, Response } from "express";
import { z } from "zod";

import { config } from "../../config";
import * as UserRepository from "../../db/repositories/user.repository";
import { UnauthorizedError, ValidationError } from "../../error";
import { getGoogleOAuthURL, getHostName, hashKey } from "../../utils/helpers";
import logger from "../../utils/logger";
import { apiValidationMiddleware, validationMiddleware } from "../middleware";
import * as AuthService from "./auth.service";

const router = express.Router();

// Validation schemas
const registerValidation = z.object({
  email: z
    .string({ required_error: "email is required!" })
    .email({ message: "must be a valid email address!" }),
  name: z.string({ required_error: "name is required!" }),
});

const verifyEmailValidation = z.object({
  email: z
    .string({ required_error: "email is required!" })
    .email({ message: "must be a valid email address!" }),
  token: z.string({ required_error: "token is required!" }),
});

const resetApiKeyValidation = z.object({
  email: z
    .string({ required_error: "email is required!" })
    .email({ message: "must be a valid email address!" }),
});

type RegisterType = z.infer<typeof registerValidation>;
type VerifyEmailType = z.infer<typeof verifyEmailValidation>;
type ResetApiKeyType = z.infer<typeof resetApiKeyValidation>;

// Google OAuth types and helpers
interface GoogleOauthToken {
  access_token: string;
  id_token: string;
  expires_in: number;
  refresh_token: string;
  token_type: string;
  scope: string;
}

interface GoogleUserResult {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

async function getGoogleOauthToken({ code }: { code: string }): Promise<GoogleOauthToken> {
  const url = "https://oauth2.googleapis.com/token";

  const params = new URLSearchParams({
    code,
    client_id: config.oauth.google.clientId,
    client_secret: config.oauth.google.clientSecret,
    redirect_uri: config.oauth.google.redirectUrl,
    grant_type: "authorization_code",
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    return response.json();
  } catch (error: any) {
    logger.error("Failed to fetch Google Oauth Tokens");
    throw error;
  }
}

async function getGoogleUser({
  id_token,
  access_token,
}: {
  id_token: string;
  access_token: string;
}): Promise<GoogleUserResult> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`,
      {
        headers: {
          Authorization: `Bearer ${id_token}`,
        },
      },
    );

    return response.json();
  } catch (error: any) {
    logger.error("Failed to fetch Google User info");
    throw error;
  }
}

// ============================================================================
// VIEW ROUTES (HTML pages)
// ============================================================================

/**
 * GET /register
 * @tags auth
 * @summary get register page
 */
router.get("/register", (req: Request, res: Response) => {
  return res.status(200).render("auth/auth-register.html", {
    path: "/register",
    messages: req.flash(),
  });
});

/**
 * POST /register
 * @tags auth
 * @summary post register page (form)
 */
router.post(
  "/register",
  validationMiddleware({ body: registerValidation }),
  async (req: Request<{}, {}, RegisterType>, res: Response) => {
    const { email, name } = req.body;

    const found = await UserRepository.findByEmail(email);

    if (found) {
      req.flash("error", "Email already exist!");
      return res.redirect("/register");
    }

    const { key: token } = await hashKey();

    const createdUser = await UserRepository.create({ email, name, verification_token: token });

    const hostname = getHostName(req);

    logger.info(`user_id: ${createdUser.id} has registered an account!`);

    AuthService.sendVerificationEmail({
      name,
      email,
      verification_token: token,
      hostname,
      userId: String(createdUser.id),
    });

    req.flash("info", "Thank you for registering. Please check your email for confirmation!");

    return res.redirect("/register");
  },
);

/**
 * GET /reset-api-key
 * @tags auth
 * @summary get reset api key page
 */
router.get("/reset-api-key", (req: Request, res: Response) => {
  return res.status(200).render("auth/auth-reset-api-key.html", {
    path: "/reset-api-key",
    messages: req.flash(),
  });
});

/**
 * POST /reset-api-key
 * @tags auth
 * @summary post reset api key page (form)
 */
router.post(
  "/reset-api-key",
  validationMiddleware({ body: resetApiKeyValidation }),
  async (req: Request<{}, {}, ResetApiKeyType>, res: Response) => {
    const { email } = req.body;

    const foundUser = await UserRepository.findByEmail(email);

    if (foundUser && foundUser.verified === false) {
      AuthService.sendVerificationEmail({
        hostname: getHostName(req),
        userId: String(foundUser.id),
        name: foundUser.name,
        email: foundUser.email,
        verification_token: foundUser.verification_token!,
      });
    }

    if (foundUser && foundUser.verified === true && foundUser.admin === true) {
      AuthService.resetAdminAPIKey({
        userId: String(foundUser.id),
        name: foundUser.name,
        email: foundUser.email,
      });
    } else if (foundUser && foundUser.verified === true) {
      AuthService.resetAPIKey({
        userId: String(foundUser.id),
        name: foundUser.name,
        email: foundUser.email,
      });
    }

    req.flash("info", "If you have an account with us, we will send you a new api key!");

    res.redirect("/reset-api-key");
  },
);

/**
 * GET /verify-email
 * @tags auth
 * @summary verify email address (from email link)
 */
router.get("/verify-email", async (req: Request, res: Response) => {
  const { token, email } = req.query as { token: string; email: string };
  const foundUser = await UserRepository.findByEmail(email);

  if (!foundUser) {
    req.flash("error", "Something wrong while verifying your account!");
    return res.redirect("/register");
  }

  if (foundUser.verification_token !== token) {
    req.flash("error", "Something wrong while verifying your account!");
    return res.redirect("/register");
  }

  if (foundUser.verified === true) {
    req.flash("error", "This e-mail has already been used for verification!");
    return res.redirect("/register");
  }

  AuthService.sendWelcomeEmail({
    name: foundUser.name,
    email: foundUser.email,
    userId: String(foundUser.id),
  });

  req.flash(
    "success",
    "Thank you for verifying your email address. We will send you an API key to your email very shortly!",
  );

  return res.redirect("/register");
});

// ============================================================================
// OAUTH ROUTES
// ============================================================================

/**
 * GET /api/auth/oauth/google
 * @tags auth
 * @summary get google oauth url
 */
router.get("/oauth/google", async (req: Request, res: Response) => {
  res.redirect(getGoogleOAuthURL());
});

/**
 * GET /api/auth/oauth/google/redirect
 * @tags auth
 * @summary google oauth callback
 */
router.get("/oauth/google/redirect", async (req: Request, res: Response) => {
  const code = req.query.code as string;

  if (!code) {
    throw new UnauthorizedError("Something went wrong while authenticating with Google");
  }

  const { id_token, access_token } = await getGoogleOauthToken({ code });

  const googleUser = await getGoogleUser({
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

    AuthService.sendWelcomeEmail({
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
});

// ============================================================================
// API ROUTES (JSON responses)
// ============================================================================

/**
 * POST /api/auth/register
 * @tags auth
 * @summary register via API
 */
router.post(
  "/api/register",
  apiValidationMiddleware({ body: registerValidation }),
  async (req: Request<{}, {}, RegisterType>, res: Response) => {
    const { email, name } = req.body;

    const found = await UserRepository.findByEmail(email);

    if (found) {
      throw new ValidationError("email already exist");
    }

    const { key: token } = await hashKey();

    const createdUser = await UserRepository.create({ email, name, verification_token: token });

    const hostname = getHostName(req);

    logger.info(`user_id: ${createdUser.id} has registered an account!`);

    AuthService.sendVerificationEmail({
      name,
      email,
      verification_token: token,
      hostname,
      userId: String(createdUser.id),
    });

    res.status(201).json({
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
  },
);

/**
 * POST /api/auth/verify-email
 * @tags auth
 * @summary verify email via API
 */
router.post(
  "/api/verify-email",
  apiValidationMiddleware({ body: verifyEmailValidation }),
  async (req: Request<{}, {}, VerifyEmailType>, res: Response) => {
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

    const unhashedKey = await AuthService.sendWelcomeEmail({
      name: foundUser.name,
      email: foundUser.email,
      userId: String(foundUser.id),
    });

    res.status(200).json({
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
  },
);

/**
 * POST /api/auth/reset-api-key
 * @tags auth
 * @summary reset api key via API
 */
router.post(
  "/api/reset-api-key",
  apiValidationMiddleware({ body: resetApiKeyValidation }),
  async (req: Request<{}, {}, ResetApiKeyType>, res: Response) => {
    const { email } = req.body;

    const foundUser = await UserRepository.findByEmail(email);

    if (foundUser && foundUser.verified === false) {
      AuthService.sendVerificationEmail({
        hostname: getHostName(req),
        userId: String(foundUser.id),
        name: foundUser.name,
        email: foundUser.email,
        verification_token: foundUser.verification_token!,
      });
    }

    if (foundUser && foundUser.verified === true && foundUser.admin === true) {
      AuthService.resetAdminAPIKey({
        userId: String(foundUser.id),
        name: foundUser.name,
        email: foundUser.email,
      });
    } else if (foundUser && foundUser.verified === true) {
      AuthService.resetAPIKey({
        userId: String(foundUser.id),
        name: foundUser.name,
        email: foundUser.email,
      });
    }

    res.status(200).json({
      status: "success",
      request_url: req.originalUrl,
      message:
        "If you have an account with us, we will send you a new api key to your email very shortly!",
      data: [],
    });
  },
);

export default router;
