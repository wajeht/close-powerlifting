import express, { Request, Response } from "express";
import { z } from "zod";

import { config } from "../../config";
import { findByEmail, create } from "../../db/repositories/user.repository";
import { UnauthorizedError, ValidationError } from "../../error";
import { getGoogleOAuthURL, getHostName, hashKey, timingSafeEqual } from "../../utils/helpers";
import { logger } from "../../utils/logger";
import { apiValidationMiddleware, validationMiddleware } from "../middleware";
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  resetAPIKey,
  resetAdminAPIKey,
} from "./auth.service";

const authRouter = express.Router();

const registerValidation = z.object({
  email: z.email({ message: "must be a valid email address!" }),
  name: z.string({ message: "name is required!" }),
});

const verifyEmailValidation = z.object({
  email: z.email({ message: "must be a valid email address!" }),
  token: z.string({ message: "token is required!" }),
});

const resetApiKeyValidation = z.object({
  email: z.email({ message: "must be a valid email address!" }),
});

type RegisterType = z.infer<typeof registerValidation>;
type VerifyEmailType = z.infer<typeof verifyEmailValidation>;
type ResetApiKeyType = z.infer<typeof resetApiKeyValidation>;

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

authRouter.get("/register", (req: Request, res: Response) => {
  return res.status(200).render("auth/auth-register.html", {
    path: "/register",
    messages: req.flash(),
  });
});

authRouter.post(
  "/register",
  validationMiddleware({ body: registerValidation }),
  async (req: Request<{}, {}, RegisterType>, res: Response) => {
    const { email, name } = req.body;

    const found = await findByEmail(email);

    if (found) {
      req.flash("error", "Email already exist!");
      return res.redirect("/register");
    }

    const { key: token } = await hashKey();

    const createdUser = await create({ email, name, verification_token: token });

    const hostname = getHostName(req);

    logger.info(`user_id: ${createdUser.id} has registered an account!`);

    sendVerificationEmail({
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

authRouter.get("/reset-api-key", (req: Request, res: Response) => {
  return res.status(200).render("auth/auth-reset-api-key.html", {
    path: "/reset-api-key",
    messages: req.flash(),
  });
});

authRouter.post(
  "/reset-api-key",
  validationMiddleware({ body: resetApiKeyValidation }),
  async (req: Request<{}, {}, ResetApiKeyType>, res: Response) => {
    const { email } = req.body;

    const foundUser = await findByEmail(email);

    logger.info(
      `Reset API key requested for email: ${email}, found: ${!!foundUser}, verified: ${foundUser?.verified}, admin: ${foundUser?.admin}`,
    );

    if (foundUser && !foundUser.verified) {
      logger.info(`User ${email} not verified, sending verification email`);
      await sendVerificationEmail({
        hostname: getHostName(req),
        userId: String(foundUser.id),
        name: foundUser.name,
        email: foundUser.email,
        verification_token: foundUser.verification_token!,
      });
    } else if (foundUser && foundUser.verified && foundUser.admin) {
      logger.info(`User ${email} is admin, resetting admin API key`);
      await resetAdminAPIKey({
        userId: String(foundUser.id),
        name: foundUser.name,
        email: foundUser.email,
      });
    } else if (foundUser && foundUser.verified) {
      logger.info(`User ${email} is verified, resetting API key`);
      await resetAPIKey({
        userId: String(foundUser.id),
        name: foundUser.name,
        email: foundUser.email,
      });
    }

    req.flash("info", "If you have an account with us, we will send you a new api key!");

    res.redirect("/reset-api-key");
  },
);

authRouter.get("/verify-email", async (req: Request, res: Response) => {
  const { token, email } = req.query as { token: string; email: string };
  const foundUser = await findByEmail(email);

  if (!foundUser) {
    req.flash("error", "Something wrong while verifying your account!");
    return res.redirect("/register");
  }

  if (!foundUser.verification_token || !timingSafeEqual(foundUser.verification_token, token)) {
    req.flash("error", "Something wrong while verifying your account!");
    return res.redirect("/register");
  }

  if (foundUser.verified === true) {
    req.flash("error", "This e-mail has already been used for verification!");
    return res.redirect("/register");
  }

  sendWelcomeEmail({
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

authRouter.get("/oauth/google", async (req: Request, res: Response) => {
  res.redirect(getGoogleOAuthURL());
});

authRouter.get("/oauth/google/redirect", async (req: Request, res: Response) => {
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

  const found = await findByEmail(googleUser.email);

  if (!found) {
    const createdUser = await create({
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
});

authRouter.post(
  "/api/register",
  apiValidationMiddleware({ body: registerValidation }),
  async (req: Request<{}, {}, RegisterType>, res: Response) => {
    const { email, name } = req.body;

    const found = await findByEmail(email);

    if (found) {
      throw new ValidationError("email already exist");
    }

    const { key: token } = await hashKey();

    const createdUser = await create({ email, name, verification_token: token });

    const hostname = getHostName(req);

    logger.info(`user_id: ${createdUser.id} has registered an account!`);

    sendVerificationEmail({
      name,
      email,
      verification_token: token,
      hostname,
      userId: String(createdUser.id),
    });

    res.status(201).json({
      status: "success",
      request_url: req.originalUrl,
      message: "Thank you for registering. Please check your email for confirmation.",
      data: [],
    });
  },
);

authRouter.post(
  "/api/verify-email",
  apiValidationMiddleware({ body: verifyEmailValidation }),
  async (req: Request<{}, {}, VerifyEmailType>, res: Response) => {
    const { token, email } = req.body;

    const foundUser = await findByEmail(email);

    if (!foundUser) {
      throw new ValidationError("Something wrong while verifying your account!");
    }

    if (!foundUser.verification_token || !timingSafeEqual(foundUser.verification_token, token)) {
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

authRouter.post(
  "/api/reset-api-key",
  apiValidationMiddleware({ body: resetApiKeyValidation }),
  async (req: Request<{}, {}, ResetApiKeyType>, res: Response) => {
    const { email } = req.body;

    const foundUser = await findByEmail(email);

    if (foundUser && !foundUser.verified) {
      await sendVerificationEmail({
        hostname: getHostName(req),
        userId: String(foundUser.id),
        name: foundUser.name,
        email: foundUser.email,
        verification_token: foundUser.verification_token!,
      });
    } else if (foundUser && foundUser.verified && foundUser.admin) {
      await resetAdminAPIKey({
        userId: String(foundUser.id),
        name: foundUser.name,
        email: foundUser.email,
      });
    } else if (foundUser && foundUser.verified) {
      await resetAPIKey({
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

export { authRouter };
