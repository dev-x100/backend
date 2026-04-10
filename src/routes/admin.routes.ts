import { Router } from "express";
import {
  getDashboardStats,
  adminListWebinars,
  adminCreateWebinar,
  adminUpdateWebinar,
  adminDeleteWebinar,
  adminListUsers,
  adminDeleteUser,
  adminListRegistrations,
  adminListContacts,
} from "../controllers/admin.controller";
import { authenticate } from "../middleware/auth";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

// Every admin route requires valid token + ADMIN role
router.use(authenticate, requireAdmin);

router.get("/dashboard", getDashboardStats);

router.get("/webinars", adminListWebinars);
router.post("/webinars", adminCreateWebinar);
router.put("/webinars/:id", adminUpdateWebinar);
router.delete("/webinars/:id", adminDeleteWebinar);

router.get("/users", adminListUsers);
router.delete("/users/:id", adminDeleteUser);

router.get("/registrations", adminListRegistrations);
router.get("/contacts", adminListContacts);

export default router;
