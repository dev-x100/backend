import { Router, Request, Response, NextFunction } from "express";
import { createCheckoutSession, stripeWebhook, verifySession } from "../controllers/payment.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// Stripe webhook MUST receive raw body — mount BEFORE express.json() parses it
// We handle this by express.raw() on this specific path (see app.ts)
router.post(
  "/webhook",
  (req: Request, res: Response, next: NextFunction) => next(), // already raw via app.ts route
  stripeWebhook
);

// Authenticated routes
router.post("/checkout", authenticate, createCheckoutSession);
router.get("/session/:id", authenticate, verifySession);

export default router;
