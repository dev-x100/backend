import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../db/client";

// GET /api/webinars  — public list (with optional filters)
export async function listWebinars(req: Request, res: Response): Promise<void> {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const page = typeof req.query.page === "string" ? req.query.page : "1";
  const limit = typeof req.query.limit === "string" ? req.query.limit : "12";

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const validType = type === "LIVE" ? "LIVE" as const : type === "RECORDED" ? "RECORDED" as const : undefined;
  const where = {
    isPublished: true,
    ...(validType ? { type: validType } : {}),
    ...(category ? { category: { contains: category, mode: "insensitive" as const } } : {}),
  };

  const [webinars, total] = await Promise.all([
    prisma.webinar.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { date: "asc" },
      select: {
        id: true,
        title: true,
        speaker: true,
        imageUrl: true,
        date: true,
        category: true,
        type: true,
        price: true,
        seats: true,
        _count: { select: { registrations: true } },
      },
    }),
    prisma.webinar.count({ where }),
  ]);

  res.json({
    webinars,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
}

// GET /api/webinars/:id  — public detail
export async function getWebinar(req: Request, res: Response): Promise<void> {
  const webinar = await prisma.webinar.findUnique({
    where: { id: req.params.id as string, isPublished: true },
    include: { _count: { select: { registrations: true } } },
  });

  if (!webinar) {
    res.status(404).json({ message: "Webinar not found" });
    return;
  }

  res.json({ webinar });
}

// POST /api/webinars/:id/register  — must be authenticated user
export async function registerForWebinar(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const webinarId = req.params.id as string;

  const webinar = await prisma.webinar.findUnique({
    where: { id: webinarId, isPublished: true },
    include: { _count: { select: { registrations: true } } },
  });

  if (!webinar) {
    res.status(404).json({ message: "Webinar not found" });
    return;
  }

  if (webinar._count.registrations >= webinar.seats) {
    res.status(409).json({ message: "This webinar is fully booked" });
    return;
  }

  const existing = await prisma.registration.findUnique({
    where: { userId_webinarId: { userId, webinarId } },
  });

  if (existing) {
    res.status(409).json({ message: "Already registered for this webinar" });
    return;
  }

  const registration = await prisma.registration.create({
    data: { userId, webinarId },
    include: { webinar: { select: { title: true, date: true } } },
  });

  res.status(201).json({ message: "Registered successfully", registration });
}

// GET /api/webinars/my-registrations  — own registrations
export async function myRegistrations(req: Request, res: Response): Promise<void> {
  const registrations = await prisma.registration.findMany({
    where: { userId: req.user!.userId },
    include: {
      webinar: {
        select: { id: true, title: true, speaker: true, date: true, category: true, type: true },
      },
    },
    orderBy: { registeredAt: "desc" },
  });

  res.json({ registrations });
}
