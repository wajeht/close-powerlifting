import express, { Request, Response } from "express";
import { z } from "zod";

import type { AppContext } from "../../context";
import { UnauthorizedError } from "../../error";
import { createMiddleware } from "../middleware";

const MAGIC_LINK_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const loginValidation = z.object({
  email: z.email({ message: "must be a valid email address!" }),
});

type LoginType = z.infer<typeof loginValidation>;

export function createAuthRouter(context: AppContext) {
  const middleware = createMiddleware(
    context.cache,
    context.userRepository,
    context.mail,
    context.helpers,
    context.logger,
    context.knex,
    context.authService,
    context.apiCallLogRepository,
  );

  const router = express.Router();

  router.get("/login", (req: Request, res: Response) => {
    if (req.session.user) {
      req.flash("info", "You are already logged in.");
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
    middleware.authRateLimitMiddleware,
    middleware.turnstileMiddleware,
    middleware.csrfValidationMiddleware,
    middleware.validationMiddleware({ body: loginValidation }),
    async (req: Request<{}, {}, LoginType>, res: Response) => {
      const { email } = req.body;
      const hostname = context.helpers.getHostName(req);

      let user = await context.userRepository.findByEmail(email);

      if (!user) {
        const token = context.helpers.generateToken();
        const name = context.helpers.extractNameFromEmail(email);
        const verificationExpiresAt = new Date(
          Date.now() + VERIFICATION_TOKEN_EXPIRY_MS,
        ).toISOString();

        user = await context.userRepository.create({
          email,
          name,
          verification_token: token,
          magic_link_expires_at: verificationExpiresAt,
        });

        context.logger.info(`user_id: ${user.id} has registered an account!`);

        context.authService.sendVerificationEmail({
          name,
          email,
          verification_token: token,
          hostname,
        });

        req.flash("info", "If this email is registered, you will receive an email shortly.");
        return res.redirect("/login");
      }

      if (!user.verified) {
        const newToken = context.helpers.generateToken();
        const verificationExpiresAt = new Date(
          Date.now() + VERIFICATION_TOKEN_EXPIRY_MS,
        ).toISOString();

        await context.userRepository.updateById(user.id, {
          verification_token: newToken,
          magic_link_expires_at: verificationExpiresAt,
        });

        context.authService.sendVerificationEmail({
          name: user.name,
          email: user.email,
          verification_token: newToken,
          hostname,
        });
        req.flash("info", "If this email is registered, you will receive an email shortly.");
        return res.redirect("/login");
      }

      const token = context.helpers.generateToken();
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

      req.flash("info", "If this email is registered, you will receive an email shortly.");
      return res.redirect("/login");
    },
  );

  router.post("/logout", middleware.csrfValidationMiddleware, (req: Request, res: Response) => {
    const sessionUser = req.session.user;
    req.session.destroy(() => {
      context.logger.info(`User ${sessionUser?.id} (${sessionUser?.email}) logged out`);
      res.redirect("/login");
    });
  });

  router.get(
    "/magic-link",
    middleware.authRateLimitMiddleware,
    async (req: Request, res: Response) => {
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

      if (user.magic_link_expires_at) {
        const expiresAt = new Date(user.magic_link_expires_at);
        if (expiresAt < new Date()) {
          req.flash("error", "Magic link has expired. Please request a new one.");
          return res.redirect("/login");
        }
      }

      const tokenConsumed = await context.userRepository.consumeToken(
        user.id,
        user.verification_token,
      );
      if (!tokenConsumed) {
        req.flash("error", "This magic link has already been used. Please request a new one.");
        return res.redirect("/login");
      }

      req.session.regenerate((err) => {
        if (err) {
          context.logger.error(err);
          req.flash("error", "Login failed. Please try again.");
          return res.redirect("/login");
        }

        req.session.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          admin: Boolean(user.admin),
        };

        req.session.save(() => {
          req.flash("info", "You have been logged in.");
          context.logger.info(`User ${user.id} (${user.email}) logged in via magic link`);
          res.redirect("/dashboard");
        });
      });
    },
  );

  router.get(
    "/verify-email",
    middleware.authRateLimitMiddleware,
    async (req: Request, res: Response) => {
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

      if (foundUser.magic_link_expires_at) {
        const expiresAt = new Date(foundUser.magic_link_expires_at);
        if (expiresAt < new Date()) {
          req.flash(
            "error",
            "Verification link has expired. Please request a new one by logging in.",
          );
          return res.redirect("/login");
        }
      }

      if (foundUser.verified) {
        req.flash("info", "Your email is already verified. Please login.");
        return res.redirect("/login");
      }

      const tokenConsumed = await context.userRepository.consumeToken(
        foundUser.id,
        foundUser.verification_token,
      );
      if (!tokenConsumed) {
        req.flash("error", "This verification link has already been used. Please login.");
        return res.redirect("/login");
      }

      await context.authService.sendWelcomeEmail({
        name: foundUser.name,
        email: foundUser.email,
        userId: String(foundUser.id),
        apiKeyVersion: foundUser.api_key_version || 1,
      });

      req.session.regenerate((err) => {
        if (err) {
          context.logger.error(err);
          req.flash("success", "Your email has been verified! Please login.");
          return res.redirect("/login");
        }

        req.session.user = {
          id: foundUser.id,
          email: foundUser.email,
          name: foundUser.name,
          admin: Boolean(foundUser.admin),
        };

        req.session.save(() => {
          context.logger.info(`User ${foundUser.id} (${foundUser.email}) verified and logged in`);
          req.flash(
            "success",
            "Your email has been verified! Your API key has been sent to your email. You can also view it in Settings.",
          );
          res.redirect("/dashboard");
        });
      });
    },
  );

  router.get("/oauth/google", async (req: Request, res: Response) => {
    const state = context.authService.generateOAuthState();
    req.session.oauthState = state;
    res.redirect(context.authService.getGoogleOAuthURL(state));
  });

  router.get("/oauth/google/redirect", async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!code) {
      throw new UnauthorizedError("Something went wrong while authenticating with Google");
    }

    if (
      !state ||
      !req.session.oauthState ||
      !context.helpers.timingSafeEqual(req.session.oauthState, state)
    ) {
      delete req.session.oauthState;
      throw new UnauthorizedError("Invalid OAuth state - please try again");
    }
    delete req.session.oauthState;

    const { id_token, access_token } = await context.authService.getGoogleOAuthToken({ code });

    const googleUser = await context.authService.getGoogleUser({
      id_token,
      access_token,
    });

    if (!googleUser.verified_email) {
      throw new UnauthorizedError("Something went wrong while authenticating with Google");
    }

    let user = await context.userRepository.findByEmail(googleUser.email);

    if (!user) {
      user = await context.userRepository.create({
        email: googleUser.email,
        name: googleUser.name,
        verified: true,
        verified_at: new Date().toISOString(),
      });

      await context.authService.sendWelcomeEmail({
        name: user.name,
        email: user.email,
        userId: String(user.id),
        apiKeyVersion: user.api_key_version || 1,
      });

      context.logger.info(`User ${user.id} created via Google OAuth`);
    }

    req.session.regenerate((err) => {
      if (err) {
        context.logger.error(err);
        throw new UnauthorizedError("Login failed. Please try again.");
      }

      req.session.user = {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        admin: Boolean(user!.admin),
      };

      req.session.save(() => {
        context.logger.info(`User ${user!.id} (${user!.email}) logged in via Google OAuth`);
        res.redirect("/dashboard");
      });
    });
  });

  return router;
}
