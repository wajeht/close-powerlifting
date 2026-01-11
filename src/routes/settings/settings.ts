import express, { Request, Response } from "express";
import { z } from "zod";

import type { AppContext } from "../../context";
import { createMiddleware } from "../middleware";

const updateNameValidation = z.object({
  name: z.string({ message: "name is required!" }).min(1, "name is required"),
});

type UpdateNameType = z.infer<typeof updateNameValidation>;

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
    "/",
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
    "/",
    middleware.sessionAuthenticationMiddleware,
    middleware.csrfValidationMiddleware,
    middleware.validationMiddleware({ body: updateNameValidation }),
    async (req: Request<{}, {}, UpdateNameType>, res: Response) => {
      const sessionUser = req.session.user!;
      const { name } = req.body;

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

      req.flash("success", "Name updated successfully");
      return res.redirect("/settings");
    },
  );

  router.post(
    "/regenerate-key",
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
    "/delete",
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
