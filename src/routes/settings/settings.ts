import express, { Request, Response } from "express";
import { z } from "zod";

import type { AppContext } from "../../context";
import { createMiddleware } from "../middleware";

const VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const updateSettingsValidation = z.object({
  name: z.string({ message: "name is required!" }).min(1, "name is required"),
  email: z.string().email().optional(),
});

type UpdateSettingsType = z.infer<typeof updateSettingsValidation>;

export function createSettingsRouter(context: AppContext) {
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

      return res.render("settings/settings.html", {
        title: "Settings",
        path: "/settings",
        user,
        messages: req.flash(),
        layout: "_layouts/authenticated.html",
      });
    },
  );

  router.post(
    "/settings",
    middleware.sessionAuthenticationMiddleware,
    middleware.csrfValidationMiddleware,
    middleware.validationMiddleware({ body: updateSettingsValidation }),
    async (req: Request<{}, {}, UpdateSettingsType>, res: Response) => {
      const sessionUser = req.session.user!;
      const { name, email: newEmail } = req.body;
      const hostname = context.helpers.getHostName(req);

      const updatedUser = await context.userRepository.updateById(sessionUser.id, { name });

      if (updatedUser) {
        req.session.user = {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          admin: Boolean(updatedUser.admin),
        };
      }

      context.logger.info(`User ${sessionUser.id} (${sessionUser.email}) updated name to ${name}`);

      if (newEmail && newEmail !== sessionUser.email) {
        const existingUser = await context.userRepository.findByEmail(newEmail);
        if (existingUser) {
          req.flash("error", "This email address is already in use.");
          return res.redirect("/settings");
        }

        const token = context.helpers.generateToken();
        const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS).toISOString();

        await context.userRepository.updateById(sessionUser.id, {
          pending_email: newEmail,
          pending_email_token: token,
          pending_email_expires_at: expiresAt,
        });

        void context.authService.sendEmailChangeVerificationEmail({
          name: updatedUser?.name || sessionUser.name,
          email: newEmail,
          token,
          hostname,
        });

        context.logger.info(
          `User ${sessionUser.id} (${sessionUser.email}) requested email change to ${newEmail}`,
        );

        req.flash(
          "info",
          "A verification link has been sent to your new email address. Please verify it to complete the email change.",
        );
      } else {
        req.flash("success", "Name updated successfully.");
      }

      return res.redirect("/settings");
    },
  );

  router.post(
    "/settings/regenerate-key",
    middleware.sessionAuthenticationMiddleware,
    middleware.csrfValidationMiddleware,
    async (req: Request, res: Response) => {
      const sessionUser = req.session.user!;
      const user = await context.userRepository.findById(sessionUser.id);

      if (!user) {
        req.session.destroy(() => {
          res.redirect("/login");
        });
        return;
      }

      await context.authService.regenerateKey(sessionUser.id);

      const updatedUser = await context.userRepository.findById(sessionUser.id);

      req.flash("success", "Your new API key has been generated and sent to your email!");

      return res.render("settings/settings.html", {
        title: "Settings",
        path: "/settings",
        user: updatedUser,
        messages: req.flash(),
        layout: "_layouts/authenticated.html",
      });
    },
  );

  router.post(
    "/settings/delete",
    middleware.sessionAuthenticationMiddleware,
    middleware.csrfValidationMiddleware,
    async (req: Request, res: Response) => {
      const sessionUser = req.session.user!;

      await context.userRepository.delete(sessionUser.id);

      context.logger.info(`User ${sessionUser.id} (${sessionUser.email}) deleted their account`);

      req.session.destroy(() => {
        res.redirect("/login");
      });
    },
  );

  return router;
}
