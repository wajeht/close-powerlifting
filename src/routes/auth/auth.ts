import express, { Request, Response } from "express";
import { z } from "zod";

import { configuration } from "../../configuration";
import type { AppContext } from "../../context";
import { UnauthorizedError, ValidationError } from "../../error";
import { createMiddleware } from "../middleware";

const MAGIC_LINK_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

const loginValidation = z.object({
  email: z.email({ message: "must be a valid email address!" }),
});

const magicLinkValidation = z.object({
  email: z.email({ message: "must be a valid email address!" }),
  token: z.string({ message: "token is required!" }),
});

const updateNameValidation = z.object({
  name: z.string({ message: "name is required!" }).min(1, "name is required"),
});

type LoginType = z.infer<typeof loginValidation>;
type MagicLinkType = z.infer<typeof magicLinkValidation>;
type UpdateNameType = z.infer<typeof updateNameValidation>;

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

export function createAuthRouter(context: AppContext) {
  const middleware = createMiddleware(
    context.cache,
    context.userRepository,
    context.mail,
    context.helpers,
    context.logger,
    context.knex,
  );

  const router = express.Router();

  async function getGoogleOauthToken({ code }: { code: string }): Promise<GoogleOauthToken> {
    const url = "https://oauth2.googleapis.com/token";

    const params = new URLSearchParams({
      code,
      client_id: configuration.oauth.google.clientId,
      client_secret: configuration.oauth.google.clientSecret,
      redirect_uri: configuration.oauth.google.redirectUrl,
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
    } catch (error: unknown) {
      context.logger.error("Failed to fetch Google Oauth Tokens");
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
    } catch (error: unknown) {
      context.logger.error("Failed to fetch Google User info");
      throw error;
    }
  }

  router.get("/login", (req: Request, res: Response) => {
    if (req.session.user) {
      return res.redirect("/dashboard");
    }
    return res.status(200).render("auth/login.html", {
      path: "/login",
      title: "Login",
      messages: req.flash(),
    });
  });

  router.post(
    "/login",
    middleware.validationMiddleware({ body: loginValidation }),
    async (req: Request<{}, {}, LoginType>, res: Response) => {
      const { email } = req.body;
      const hostname = context.helpers.getHostName(req);

      let user = await context.userRepository.findByEmail(email);

      // Create new user if doesn't exist
      if (!user) {
        const { key: token } = await context.helpers.hashKey();
        const name = context.helpers.extractNameFromEmail(email);

        user = await context.userRepository.create({
          email,
          name,
          verification_token: token,
        });

        context.logger.info(`user_id: ${user.id} has registered an account!`);

        context.authService.sendVerificationEmail({
          name,
          email,
          verification_token: token,
          hostname,
        });

        req.flash("info", "Check your email to verify your account and get your API key.");
        return res.redirect("/login");
      }

      if (!user.verified) {
        // Resend verification email for unverified users
        context.authService.sendVerificationEmail({
          name: user.name,
          email: user.email,
          verification_token: user.verification_token!,
          hostname,
        });
        req.flash("info", "Please verify your email first. We've sent a new verification link.");
        return res.redirect("/login");
      }

      // Generate magic link token for existing verified users
      const { key: token } = await context.helpers.hashKey();
      const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MS).toISOString();

      await context.userRepository.updateById(user.id, {
        verification_token: token,
        magic_link_expires_at: expiresAt,
      });

      context.authService.sendMagicLinkEmail({
        name: user.name,
        email: user.email,
        token,
        hostname,
      });

      context.logger.info(`Magic link sent to ${user.email}`);

      req.flash("info", "Check your email for a magic link to log in.");
      return res.redirect("/login");
    },
  );

  router.post("/logout", (req: Request, res: Response) => {
    const sessionUser = req.session.user;
    req.session.destroy(() => {
      context.logger.info(`User ${sessionUser?.id} (${sessionUser?.email}) logged out`);
      res.redirect("/login");
    });
  });

  router.get("/magic-link", async (req: Request, res: Response) => {
    const { token, email } = req.query as { token: string; email: string };

    if (!token || !email) {
      req.flash("error", "Invalid magic link.");
      return res.redirect("/login");
    }

    const user = await context.userRepository.findByEmail(email);

    if (!user) {
      req.flash("error", "Invalid magic link.");
      return res.redirect("/login");
    }

    if (!user.verified) {
      req.flash("error", "Please verify your email first.");
      return res.redirect("/login");
    }

    if (
      !user.verification_token ||
      !context.helpers.timingSafeEqual(user.verification_token, token)
    ) {
      req.flash("error", "Invalid or expired magic link.");
      return res.redirect("/login");
    }

    // Check if magic link has expired
    if (user.magic_link_expires_at) {
      const expiresAt = new Date(user.magic_link_expires_at);
      if (expiresAt < new Date()) {
        req.flash("error", "Magic link has expired. Please request a new one.");
        return res.redirect("/login");
      }
    }

    // Clear the magic link token after successful use
    await context.userRepository.updateById(user.id, {
      verification_token: null,
      magic_link_expires_at: null,
    });

    // Log the user in
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      admin: Boolean(user.admin),
    };

    context.logger.info(`User ${user.id} (${user.email}) logged in via magic link`);

    return res.redirect("/dashboard");
  });

  router.get(
    "/dashboard",
    middleware.sessionAuthenticationMiddleware,
    async (req: Request, res: Response) => {
      const sessionUser = req.session.user!;
      const user = await context.userRepository.findById(sessionUser.id);

      if (!user) {
        req.session.destroy(() => {
          res.redirect("/login");
        });
        return;
      }

      const usagePercent = Math.round((user.api_call_count / user.api_call_limit) * 100);

      // Get and clear the new API key from session (shown once after verification)
      const apiKey = sessionUser.newApiKey || null;
      if (sessionUser.newApiKey) {
        delete req.session.user!.newApiKey;
      }

      let stats = null;
      if (user.admin) {
        const allUsers = await context.userRepository.findAll();
        const cacheStats = await context.cache.getStatistics();
        stats = {
          totalUsers: allUsers.length,
          verifiedUsers: allUsers.filter((u) => u.verified).length,
          unverifiedUsers: allUsers.filter((u) => !u.verified).length,
          adminUsers: allUsers.filter((u) => u.admin).length,
          cacheEntries: cacheStats.totalEntries,
          totalApiCalls: allUsers.reduce((sum, u) => sum + u.api_call_count, 0),
        };
      }

      return res.render("auth/dashboard.html", {
        title: "Dashboard",
        path: "/dashboard",
        user,
        usagePercent,
        apiKey,
        stats,
        messages: req.flash(),
        layout: "_layouts/authenticated.html",
      });
    },
  );

  router.get(
    "/settings",
    middleware.sessionAuthenticationMiddleware,
    async (req: Request, res: Response) => {
      const sessionUser = req.session.user!;
      const user = await context.userRepository.findById(sessionUser.id);

      if (!user) {
        req.session.destroy(() => {
          res.redirect("/login");
        });
        return;
      }

      return res.render("auth/settings.html", {
        title: "Settings",
        path: "/settings",
        user,
        apiKey: null,
        messages: req.flash(),
        layout: "_layouts/authenticated.html",
      });
    },
  );

  router.post(
    "/settings",
    middleware.sessionAuthenticationMiddleware,
    middleware.validationMiddleware({ body: updateNameValidation }),
    async (req: Request<{}, {}, UpdateNameType>, res: Response) => {
      const sessionUser = req.session.user!;
      const { name } = req.body;

      await context.userRepository.updateById(sessionUser.id, { name });

      // Update session with new name
      req.session.user!.name = name;

      context.logger.info(`User ${sessionUser.id} (${sessionUser.email}) updated name to ${name}`);

      req.flash("success", "Name updated successfully");
      return res.redirect("/settings");
    },
  );

  router.post(
    "/settings/regenerate-key",
    middleware.sessionAuthenticationMiddleware,
    async (req: Request, res: Response) => {
      const sessionUser = req.session.user!;
      const user = await context.userRepository.findById(sessionUser.id);

      if (!user) {
        req.session.destroy(() => {
          res.redirect("/login");
        });
        return;
      }

      const unhashedKey = await context.authService.sendWelcomeEmail({
        name: user.name,
        email: user.email,
        userId: String(user.id),
      });

      await context.userRepository.updateById(sessionUser.id, {
        api_key_version: (user.api_key_version || 0) + 1,
      });

      const updatedUser = await context.userRepository.findById(sessionUser.id);

      context.logger.info(`User ${sessionUser.id} (${sessionUser.email}) regenerated API key`);

      req.flash("success", "Your new API key has been generated and sent to your email!");

      return res.render("auth/settings.html", {
        title: "Settings",
        path: "/settings",
        user: updatedUser,
        apiKey: unhashedKey,
        messages: req.flash(),
        layout: "_layouts/authenticated.html",
      });
    },
  );

  router.post(
    "/settings/delete",
    middleware.sessionAuthenticationMiddleware,
    async (req: Request, res: Response) => {
      const sessionUser = req.session.user!;

      await context.userRepository.softDelete(sessionUser.id);

      context.logger.info(`User ${sessionUser.id} (${sessionUser.email}) deleted their account`);

      req.session.destroy(() => {
        res.redirect("/login");
      });
    },
  );

  router.get("/verify-email", async (req: Request, res: Response) => {
    const { token, email } = req.query as { token: string; email: string };
    const foundUser = await context.userRepository.findByEmail(email);

    if (!foundUser) {
      req.flash("error", "Something wrong while verifying your account!");
      return res.redirect("/login");
    }

    if (
      !foundUser.verification_token ||
      !context.helpers.timingSafeEqual(foundUser.verification_token, token)
    ) {
      req.flash("error", "Something wrong while verifying your account!");
      return res.redirect("/login");
    }

    if (foundUser.verified) {
      req.flash("info", "Your email is already verified. Please login.");
      return res.redirect("/login");
    }

    const unhashedKey = await context.authService.sendWelcomeEmail({
      name: foundUser.name,
      email: foundUser.email,
      userId: String(foundUser.id),
    });

    // Clear verification token after successful verification
    await context.userRepository.updateById(foundUser.id, {
      verification_token: null,
    });

    // Log the user in automatically
    req.session.user = {
      id: foundUser.id,
      email: foundUser.email,
      name: foundUser.name,
      admin: Boolean(foundUser.admin),
      newApiKey: unhashedKey,
    };

    context.logger.info(`User ${foundUser.id} (${foundUser.email}) verified and logged in`);

    req.flash(
      "success",
      "Your email has been verified! Your API key is shown below and has also been sent to your email.",
    );

    return res.redirect("/dashboard");
  });

  router.get("/oauth/google", async (req: Request, res: Response) => {
    res.redirect(context.helpers.getGoogleOAuthURL());
  });

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

    let user = await context.userRepository.findByEmail(googleUser.email);

    if (!user) {
      // Create new user with OAuth
      user = await context.userRepository.create({
        email: googleUser.email,
        name: googleUser.name,
        verification_token: access_token,
        verified: true,
        verified_at: new Date().toISOString(),
      });

      // Generate API key and send welcome email
      context.authService.sendWelcomeEmail({
        name: user.name,
        email: user.email,
        userId: String(user.id),
      });

      context.logger.info(`User ${user.id} created via Google OAuth`);
    }

    // Log the user in
    req.session.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      admin: Boolean(user.admin),
    };

    context.logger.info(`User ${user.id} (${user.email}) logged in via Google OAuth`);

    return res.redirect("/dashboard");
  });

  router.post(
    "/api/login",
    middleware.apiValidationMiddleware({ body: loginValidation }),
    async (req: Request<{}, {}, LoginType>, res: Response) => {
      const { email } = req.body;
      const hostname = context.helpers.getHostName(req);

      let user = await context.userRepository.findByEmail(email);

      // Create new user if doesn't exist
      if (!user) {
        const { key: token } = await context.helpers.hashKey();
        const name = context.helpers.extractNameFromEmail(email);

        user = await context.userRepository.create({
          email,
          name,
          verification_token: token,
        });

        context.logger.info(`user_id: ${user.id} has registered an account!`);

        context.authService.sendVerificationEmail({
          name,
          email,
          verification_token: token,
          hostname,
        });

        res.status(201).json({
          status: "success",
          request_url: req.originalUrl,
          message: "Check your email to verify your account and get your API key.",
          data: [],
        });
        return;
      }

      if (!user.verified) {
        context.authService.sendVerificationEmail({
          name: user.name,
          email: user.email,
          verification_token: user.verification_token!,
          hostname,
        });

        res.status(200).json({
          status: "success",
          request_url: req.originalUrl,
          message: "Please verify your email first. We've sent a new verification link.",
          data: [],
        });
        return;
      }

      // Generate magic link for existing verified users
      const { key: token } = await context.helpers.hashKey();
      const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MS).toISOString();

      await context.userRepository.updateById(user.id, {
        verification_token: token,
        magic_link_expires_at: expiresAt,
      });

      context.authService.sendMagicLinkEmail({
        name: user.name,
        email: user.email,
        token,
        hostname,
      });

      context.logger.info(`Magic link sent to ${user.email}`);

      res.status(200).json({
        status: "success",
        request_url: req.originalUrl,
        message: "Check your email for a magic link to log in.",
        data: [],
      });
    },
  );

  router.post(
    "/api/verify-email",
    middleware.apiValidationMiddleware({ body: magicLinkValidation }),
    async (req: Request<{}, {}, MagicLinkType>, res: Response) => {
      const { token, email } = req.body;

      const foundUser = await context.userRepository.findByEmail(email);

      if (!foundUser) {
        throw new ValidationError("Something wrong while verifying your account!");
      }

      if (
        !foundUser.verification_token ||
        !context.helpers.timingSafeEqual(foundUser.verification_token, token)
      ) {
        throw new ValidationError("Something wrong while verifying your account!");
      }

      if (foundUser.verified) {
        throw new ValidationError("This account has already been verified!");
      }

      const unhashedKey = await context.authService.sendWelcomeEmail({
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

  return router;
}
