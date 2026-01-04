import bcrypt from "bcryptjs";
import express, { Request, Response } from "express";
import { z } from "zod";

import { configuration } from "../../configuration";
import type { AppContext } from "../../context";
import { UnauthorizedError, ValidationError } from "../../error";
import { createMiddleware } from "../middleware";

const registerValidation = z.object({
  email: z.email({ message: "must be a valid email address!" }),
  name: z.string({ message: "name is required!" }),
  password: z
    .string({ message: "password is required!" })
    .min(8, "password must be at least 8 characters"),
});

const loginValidation = z.object({
  email: z.email({ message: "must be a valid email address!" }),
  password: z.string({ message: "password is required!" }),
});

const verifyEmailValidation = z.object({
  email: z.email({ message: "must be a valid email address!" }),
  token: z.string({ message: "token is required!" }),
});

const forgotPasswordValidation = z.object({
  email: z.email({ message: "must be a valid email address!" }),
});

const resetPasswordValidation = z
  .object({
    email: z.email({ message: "must be a valid email address!" }),
    token: z.string({ message: "token is required!" }),
    password: z
      .string({ message: "password is required!" })
      .min(8, "password must be at least 8 characters"),
    confirm_password: z.string({ message: "confirm password is required!" }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "passwords do not match",
    path: ["confirm_password"],
  });

const updateNameValidation = z.object({
  name: z.string({ message: "name is required!" }).min(1, "name is required"),
});

const changePasswordValidation = z
  .object({
    current_password: z.string({ message: "current password is required!" }),
    new_password: z
      .string({ message: "new password is required!" })
      .min(8, "password must be at least 8 characters"),
    confirm_password: z.string({ message: "confirm password is required!" }),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "passwords do not match",
    path: ["confirm_password"],
  });

type RegisterType = z.infer<typeof registerValidation>;
type LoginType = z.infer<typeof loginValidation>;
type VerifyEmailType = z.infer<typeof verifyEmailValidation>;
type ForgotPasswordType = z.infer<typeof forgotPasswordValidation>;
type ResetPasswordType = z.infer<typeof resetPasswordValidation>;
type UpdateNameType = z.infer<typeof updateNameValidation>;
type ChangePasswordType = z.infer<typeof changePasswordValidation>;

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

  router.get("/register", (req: Request, res: Response) => {
    return res.status(200).render("auth/register.html", {
      path: "/register",
      title: "Get API Key",
      messages: req.flash(),
    });
  });

  router.post(
    "/register",
    middleware.validationMiddleware({ body: registerValidation }),
    async (req: Request<{}, {}, RegisterType>, res: Response) => {
      const { email, name, password } = req.body;

      const found = await context.userRepository.findByEmail(email);

      if (found) {
        req.flash("error", "Email already exist!");
        return res.redirect("/register");
      }

      const { key: token } = await context.helpers.hashKey();
      const hashedPassword = await bcrypt.hash(
        password,
        parseInt(configuration.app.passwordSalt, 10),
      );

      const createdUser = await context.userRepository.create({
        email,
        name,
        password: hashedPassword,
        verification_token: token,
      });

      const hostname = context.helpers.getHostName(req);

      context.logger.info(`user_id: ${createdUser.id} has registered an account!`);

      context.authService.sendVerificationEmail({
        name,
        email,
        verification_token: token,
        hostname,
      });

      req.flash("info", "Thank you for registering. Please check your email for confirmation!");

      return res.redirect("/register");
    },
  );

  router.get("/login", (req: Request, res: Response) => {
    if (req.session.userId) {
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
      const { email, password } = req.body;

      const user = await context.userRepository.findByEmail(email);

      if (!user || !user.password) {
        req.flash("error", "Invalid email or password");
        return res.redirect("/login");
      }

      if (!user.verified) {
        req.flash("error", "Please verify your email first");
        return res.redirect("/login");
      }

      const isValid = await bcrypt.compare(password, user.password);

      if (!isValid) {
        req.flash("error", "Invalid email or password");
        return res.redirect("/login");
      }

      req.session.userId = user.id;

      context.logger.info(`User ${user.id} (${user.email}) logged in`);

      return res.redirect("/dashboard");
    },
  );

  router.post("/logout", (req: Request, res: Response) => {
    const userId = req.session.userId;
    req.session.destroy(() => {
      context.logger.info(`User ${userId} logged out`);
      res.redirect("/login");
    });
  });

  router.get(
    "/dashboard",
    middleware.userAuthorizationMiddleware,
    async (req: Request, res: Response) => {
      const userId = req.session.userId!;
      const user = await context.userRepository.findById(userId);

      if (!user) {
        req.session.destroy(() => {
          res.redirect("/login");
        });
        return;
      }

      const usagePercent = Math.round((user.api_call_count / user.api_call_limit) * 100);

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
        stats,
        messages: req.flash(),
        layout: "_layouts/authenticated.html",
      });
    },
  );

  router.get(
    "/settings",
    middleware.userAuthorizationMiddleware,
    async (req: Request, res: Response) => {
      const userId = req.session.userId!;
      const user = await context.userRepository.findById(userId);

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
    middleware.userAuthorizationMiddleware,
    middleware.validationMiddleware({ body: updateNameValidation }),
    async (req: Request<{}, {}, UpdateNameType>, res: Response) => {
      const userId = req.session.userId!;
      const { name } = req.body;

      await context.userRepository.updateById(userId, { name });

      context.logger.info(`User ${userId} updated name to ${name}`);

      req.flash("success", "Name updated successfully");
      return res.redirect("/settings");
    },
  );

  router.post(
    "/settings/regenerate-key",
    middleware.userAuthorizationMiddleware,
    async (req: Request, res: Response) => {
      const userId = req.session.userId!;
      const user = await context.userRepository.findById(userId);

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

      await context.userRepository.updateById(userId, {
        api_key_version: (user.api_key_version || 0) + 1,
      });

      const updatedUser = await context.userRepository.findById(userId);

      context.logger.info(`User ${userId} regenerated API key`);

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
    "/settings/password",
    middleware.userAuthorizationMiddleware,
    middleware.validationMiddleware({ body: changePasswordValidation }),
    async (req: Request<{}, {}, ChangePasswordType>, res: Response) => {
      const userId = req.session.userId!;
      const { current_password, new_password } = req.body;

      const user = await context.userRepository.findById(userId);

      if (!user || !user.password) {
        req.flash("error", "Cannot change password for OAuth accounts");
        return res.redirect("/settings");
      }

      const isValid = await bcrypt.compare(current_password, user.password);

      if (!isValid) {
        req.flash("error", "Current password is incorrect");
        return res.redirect("/settings");
      }

      const hashedPassword = await bcrypt.hash(
        new_password,
        parseInt(configuration.app.passwordSalt, 10),
      );
      await context.userRepository.updateById(userId, { password: hashedPassword });

      context.logger.info(`User ${userId} changed password`);

      req.flash("success", "Password changed successfully");
      return res.redirect("/settings");
    },
  );

  router.post(
    "/settings/delete",
    middleware.userAuthorizationMiddleware,
    async (req: Request, res: Response) => {
      const userId = req.session.userId!;

      await context.userRepository.softDelete(userId);

      context.logger.info(`User ${userId} deleted their account`);

      req.session.destroy(() => {
        res.redirect("/login");
      });
    },
  );

  router.get("/forgot-password", (req: Request, res: Response) => {
    return res.status(200).render("auth/forgot-password.html", {
      path: "/forgot-password",
      title: "Forgot Password",
      messages: req.flash(),
    });
  });

  router.post(
    "/forgot-password",
    middleware.validationMiddleware({ body: forgotPasswordValidation }),
    async (req: Request<{}, {}, ForgotPasswordType>, res: Response) => {
      const { email } = req.body;

      const foundUser = await context.userRepository.findByEmail(email);

      context.logger.info(
        `Password reset requested for email: ${email}, found: ${!!foundUser}, verified: ${foundUser?.verified}`,
      );

      if (foundUser && foundUser.verified) {
        // Generate a reset token and save it
        const { key: resetToken } = await context.helpers.hashKey();
        await context.userRepository.updateById(foundUser.id, {
          verification_token: resetToken,
        });

        context.logger.info(`Sending password reset email to ${email}`);
        await context.authService.sendPasswordResetEmail({
          hostname: context.helpers.getHostName(req),
          name: foundUser.name,
          email: foundUser.email,
          token: resetToken,
        });
      } else if (foundUser && !foundUser.verified) {
        // If not verified, send verification email instead
        context.logger.info(`User ${email} not verified, sending verification email`);
        await context.authService.sendVerificationEmail({
          hostname: context.helpers.getHostName(req),
          name: foundUser.name,
          email: foundUser.email,
          verification_token: foundUser.verification_token!,
        });
      }

      req.flash("info", "If you have an account with us, we'll send you a password reset link.");

      res.redirect("/forgot-password");
    },
  );

  router.get("/reset-password", (req: Request, res: Response) => {
    const { token, email } = req.query as { token: string; email: string };

    if (!token || !email) {
      req.flash("error", "Invalid password reset link.");
      return res.redirect("/forgot-password");
    }

    return res.status(200).render("auth/reset-password.html", {
      path: "/reset-password",
      title: "Reset Password",
      token,
      email,
      messages: req.flash(),
    });
  });

  router.post(
    "/reset-password",
    middleware.validationMiddleware({ body: resetPasswordValidation }),
    async (req: Request<{}, {}, ResetPasswordType>, res: Response) => {
      const { email, token, password } = req.body;

      const foundUser = await context.userRepository.findByEmail(email);

      if (!foundUser) {
        req.flash("error", "Invalid password reset link.");
        return res.redirect("/forgot-password");
      }

      if (
        !foundUser.verification_token ||
        !context.helpers.timingSafeEqual(foundUser.verification_token, token)
      ) {
        req.flash("error", "Invalid or expired password reset link.");
        return res.redirect("/forgot-password");
      }

      // Hash the new password and update
      const hashedPassword = await bcrypt.hash(
        password,
        parseInt(configuration.app.passwordSalt, 10),
      );

      await context.userRepository.updateById(foundUser.id, {
        password: hashedPassword,
        verification_token: null,
      });

      context.logger.info(`User ${foundUser.id} (${email}) reset their password`);

      req.flash("success", "Your password has been reset. Please login with your new password.");
      return res.redirect("/login");
    },
  );

  router.get("/verify-email", async (req: Request, res: Response) => {
    const { token, email } = req.query as { token: string; email: string };
    const foundUser = await context.userRepository.findByEmail(email);

    if (!foundUser) {
      req.flash("error", "Something wrong while verifying your account!");
      return res.redirect("/register");
    }

    if (
      !foundUser.verification_token ||
      !context.helpers.timingSafeEqual(foundUser.verification_token, token)
    ) {
      req.flash("error", "Something wrong while verifying your account!");
      return res.redirect("/register");
    }

    if (foundUser.verified === true) {
      req.flash("info", "Your email is already verified. Please login.");
      return res.redirect("/login");
    }

    context.authService.sendWelcomeEmail({
      name: foundUser.name,
      email: foundUser.email,
      userId: String(foundUser.id),
    });

    req.flash(
      "success",
      "Thank you for verifying your email address. We sent you an API key to your email. Please login to access your dashboard.",
    );

    return res.redirect("/login");
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
    req.session.userId = user.id;

    context.logger.info(`User ${user.id} (${user.email}) logged in via Google OAuth`);

    return res.redirect("/dashboard");
  });

  router.post(
    "/api/register",
    middleware.apiValidationMiddleware({ body: registerValidation }),
    async (req: Request<{}, {}, RegisterType>, res: Response) => {
      const { email, name } = req.body;

      const found = await context.userRepository.findByEmail(email);

      if (found) {
        throw new ValidationError("email already exist");
      }

      const { key: token } = await context.helpers.hashKey();

      const createdUser = await context.userRepository.create({
        email,
        name,
        verification_token: token,
      });

      const hostname = context.helpers.getHostName(req);

      context.logger.info(`user_id: ${createdUser.id} has registered an account!`);

      context.authService.sendVerificationEmail({
        name,
        email,
        verification_token: token,
        hostname,
      });

      res.status(201).json({
        status: "success",
        request_url: req.originalUrl,
        message: "Thank you for registering. Please check your email for confirmation.",
        data: [],
      });
    },
  );

  router.post(
    "/api/verify-email",
    middleware.apiValidationMiddleware({ body: verifyEmailValidation }),
    async (req: Request<{}, {}, VerifyEmailType>, res: Response) => {
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

      if (foundUser.verified === true) {
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
