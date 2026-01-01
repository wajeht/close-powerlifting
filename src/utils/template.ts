import { Eta } from "eta";
import path from "path";

import { config } from "../config";

const viewsDir = path.join(process.cwd(), "src/routes");

const eta = new Eta({
  views: viewsDir,
  cache: config.app.env === "production",
  useWith: true,
  defaultExtension: ".html",
});

export function engine(
  filePath: string,
  opts: object,
  callback: (err: Error | null, html?: string) => void,
) {
  try {
    const viewName = "./" + path.relative(viewsDir, filePath);
    const renderedTemplate = eta.render(viewName, opts as Record<string, unknown>);
    callback(null, renderedTemplate);
  } catch (error) {
    callback(error as Error);
  }
}

export function layoutMiddleware(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  const originalRender = res.render.bind(res);

  res.render = function (
    view: string,
    options?: object,
    callback?: (err: Error, html: string) => void,
  ) {
    const opts = options || {};

    originalRender(view, opts, (err: Error, html: string) => {
      if (err) {
        if (callback) return callback(err, html);
        return next(err);
      }

      const layoutPath = "./_layouts/main.html";
      try {
        const finalHtml = eta.render(layoutPath, { ...opts, body: html });
        if (callback) return callback(null as unknown as Error, finalHtml);
        res.send(finalHtml);
      } catch (layoutErr) {
        if (callback) return callback(layoutErr as Error, html);
        next(layoutErr);
      }
    });
  } as typeof res.render;

  next();
}
