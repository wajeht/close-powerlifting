import { Application } from "express";
import expressJSDocSwagger from "express-jsdoc-swagger";
import type { Options } from "express-jsdoc-swagger";

import { config } from "../config";

let link = `http://localhost:${config.app.port}`;

if (config.app.env === "production") {
  link = config.app.domain;
}

const swaggerConfig = {
  info: {
    title: "close-powerlifting",
    description: "an intuitive api for open-powerlifting database",
    termsOfService: `${link}/terms`,
    contact: {
      name: "API Support",
      url: `${link}/contact`,
    },
    license: {
      name: "MIT",
      url: "https://github.com/wajeht/close-powerlifting/blob/main/LICENSE",
    },
    version: config.app.version,
  },
  security: {
    BearerAuth: {
      type: "http",
      scheme: "bearer",
    },
  },
  baseDir: "./src",
  filesPattern: ["**/routes/**/*.ts"],
  swaggerUIPath: "/docs/api",
  exposeSwaggerUI: true,
  notRequiredAsNullable: false,
} as unknown as Options;

export function expressJSDocSwaggerHandler(app: Application) {
  expressJSDocSwagger(app)(swaggerConfig);
}
