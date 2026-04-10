import { Request, Response, NextFunction } from "express";

/** Must be used AFTER authenticate() middleware */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  next();
}
