import { Router } from "express";
import { submitContact, subscribeNewsletter } from "../controllers/contact.controller";

const router = Router();

router.post("/contact", submitContact);
router.post("/newsletter/subscribe", subscribeNewsletter);

export default router;
