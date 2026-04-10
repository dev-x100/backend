import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../db/client";

const ContactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  company: z.string().max(100).optional(),
  message: z.string().min(10).max(2000),
});

const SubscribeSchema = z.object({
  email: z.string().email(),
});

// POST /api/contact
export async function submitContact(req: Request, res: Response): Promise<void> {
  const parsed = ContactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
    return;
  }

  const contact = await prisma.contact.create({ data: parsed.data });
  res.status(201).json({ message: "Message received. We will get back to you shortly.", contact });
}

// POST /api/newsletter/subscribe
export async function subscribeNewsletter(req: Request, res: Response): Promise<void> {
  const parsed = SubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Please provide a valid email address" });
    return;
  }

  const { email } = parsed.data;

  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
  if (existing) {
    res.status(200).json({ message: "You are already subscribed!" });
    return;
  }

  await prisma.newsletterSubscriber.create({ data: { email } });
  res.status(201).json({ message: "Successfully subscribed to our newsletter!" });
}
