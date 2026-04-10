import { Router } from "express";
import {
  listWebinars,
  getWebinar,
  registerForWebinar,
  myRegistrations,
} from "../controllers/webinar.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// Public
router.get("/", listWebinars);
router.get("/my-registrations", authenticate, myRegistrations);
router.get("/:id", getWebinar);

// Authenticated users
router.post("/:id/register", authenticate, registerForWebinar);

export default router;
