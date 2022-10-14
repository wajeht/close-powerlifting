import express, { NextFunction, Request, Response } from "express";

import cors from "cors";
import helmet from "helmet";
import compression from "compression";

import { JSDOM } from "jsdom";
import axios from "./utils/axios";

const app = express();

import * as appRoutes from "./app.routes";

app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { data: html } = await axios.get(`https://www.openpowerlifting.org`);

    const dom = new JSDOM(html);

    const $ = (selector: any) => dom.window.document.querySelector(selector);

    res.send(dom);
  } catch (e: any) {
    next(e);
  }
});

app.use(appRoutes.notFoundHandler);
app.use(appRoutes.errorHandler);

export default app;
