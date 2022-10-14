import { NextFunction, Request, Response } from "express";

export function notFoundHandler(
    req: Request,
    res: Response,
    next: NextFunction
) {
    return res.status(404).json({
        status: "failed",
        message: "not found!",
    });
}

export function errorHandler(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) {
    return res.status(500).json({
        status: "failed",
        message: err.message,
    });
}
