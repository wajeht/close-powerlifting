import { Eta } from "eta";
import path from "path";

import { configuration } from "../configuration";
import { asset } from "./assets";

const viewsDir = path.join(process.cwd(), "src/routes");

const eta = new Eta({
  views: viewsDir,
  cache: configuration.app.env === "production",
  useWith: true,
  defaultExtension: ".html",
});

export function renderTemplate(
  filePath: string,
  templateOptions: object,
  callback: (error: Error | null, html?: string) => void,
) {
  try {
    const viewName = "./" + path.relative(viewsDir, filePath);
    const renderedTemplate = eta.render(viewName, templateOptions as Record<string, unknown>);
    callback(null, renderedTemplate);
  } catch (renderError) {
    callback(renderError as Error);
  }
}

const isProd = configuration.app.env === "production";
const assetVersions = isProd ? asset.getAssetVersions() : null;
const randomVersion = () => String(Math.random()).slice(2, 10);
const version = {
  style: assetVersions?.style ?? randomVersion(),
  script: assetVersions?.script ?? randomVersion(),
};

export function layoutMiddleware(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) {
  const originalRender = res.render.bind(res);

  res.render = function (
    view: string,
    options?: object & { layout?: string | false },
    callback?: (error: Error, html: string) => void,
  ) {
    const renderOptions = { version, ...res.locals, ...options };
    const layout =
      (options as { layout?: string | false } | undefined)?.layout === false
        ? false
        : (options as { layout?: string } | undefined)?.layout || "_layouts/main.html";

    originalRender(view, renderOptions, (renderError: Error, html: string) => {
      if (renderError) {
        if (callback) return callback(renderError, html);
        return next(renderError);
      }

      if (!layout) {
        if (callback) return callback(null as unknown as Error, html);
        return res.send(html);
      }

      try {
        const finalHtml = eta.render(layout, { ...renderOptions, body: html });
        if (callback) return callback(null as unknown as Error, finalHtml);
        res.send(finalHtml);
      } catch (layoutError) {
        if (callback) return callback(layoutError as Error, html);
        next(layoutError);
      }
    });
  } as typeof res.render;

  next();
}
