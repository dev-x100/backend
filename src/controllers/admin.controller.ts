import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../db/client";
import { createZoomMeeting, deleteZoomMeeting } from "../services/zoom.service";

// ─── Dashboard Stats ────────────────────────────────────────────────────────

// GET /api/admin/dashboard
export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  const [totalUsers, totalWebinars, totalRegistrations, recentUsers, upcomingWebinars] =
    await Promise.all([
      prisma.user.count({ where: { role: "USER" } }),
      prisma.webinar.count(),
      prisma.registration.count(),
      prisma.user.findMany({
        where: { role: "USER" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, email: true, createdAt: true },
      }),
      prisma.webinar.findMany({
        where: { type: "LIVE", date: { gte: new Date() }, isPublished: true },
        orderBy: { date: "asc" },
        take: 5,
        select: {
          id: true,
          title: true,
          speaker: true,
          date: true,
          seats: true,
          _count: { select: { registrations: true } },
        },
      }),
    ]);

  res.json({
    stats: { totalUsers, totalWebinars, totalRegistrations },
    recentUsers,
    upcomingWebinars,
  });
}

// ─── Webinar CRUD ────────────────────────────────────────────────────────────

const WebinarSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().optional(),
  speaker: z.string().min(2).max(100),
  speakerBio: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  date: z.string().datetime(),
  durationMin: z.number().int().min(15).max(480).default(60),
  category: z.string().min(2).max(100),
  type: z.enum(["LIVE", "RECORDED"]).default("LIVE"),
  price: z.number().min(0).default(0),
  seats: z.number().int().min(1).default(100),
  isPublished: z.boolean().default(true),
});

// GET /api/admin/webinars
export async function adminListWebinars(req: Request, res: Response): Promise<void> {
  const webinars = await prisma.webinar.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { registrations: true } } },
  });
  res.json({ webinars });
}

// GET /api/admin/webinars/:id
export async function adminGetWebinar(req: Request, res: Response): Promise<void> {
  const webinar = await prisma.webinar.findUnique({
    where: { id: req.params.id as string },
    include: { _count: { select: { registrations: true } } },
  });

  if (!webinar) {
    res.status(404).json({ message: "Webinar not found" });
    return;
  }

  res.json({ webinar });
}

// POST /api/admin/webinars
export async function adminCreateWebinar(req: Request, res: Response): Promise<void> {
  const parsed = WebinarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
    return;
  }

  // Auto-create Zoom meeting for LIVE webinars
  let zoomData: { zoomMeetingId: string; zoomJoinUrl: string; zoomStartUrl: string; zoomPassword: string } | null = null;
  if (parsed.data.type === "LIVE") {
    try {
      const meeting = await createZoomMeeting({
        topic: parsed.data.title,
        startTime: new Date(parsed.data.date),
        durationMin: parsed.data.durationMin ?? 60,
      });
      zoomData = {
        zoomMeetingId: meeting.id,
        zoomJoinUrl: meeting.join_url,
        zoomStartUrl: meeting.start_url,
        zoomPassword: meeting.password,
      };
    } catch (err) {
      console.error("Zoom meeting creation failed (continuing without Zoom):", err);
    }
  }

  const webinar = await prisma.webinar.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      speaker: parsed.data.speaker,
      speakerBio: parsed.data.speakerBio ?? null,
      imageUrl: parsed.data.imageUrl || null,
      date: new Date(parsed.data.date),
      durationMin: parsed.data.durationMin,
      category: parsed.data.category,
      type: parsed.data.type,
      price: parsed.data.price,
      seats: parsed.data.seats,
      isPublished: parsed.data.isPublished,
      createdById: req.user!.userId,
      ...(zoomData
        ? {
            zoomMeetingId: zoomData.zoomMeetingId,
            zoomJoinUrl: zoomData.zoomJoinUrl,
            zoomStartUrl: zoomData.zoomStartUrl,
            zoomPassword: zoomData.zoomPassword,
          }
        : {}),
    },
  });

  res.status(201).json({ message: "Webinar created", webinar });
}

// PUT /api/admin/webinars/:id
export async function adminUpdateWebinar(req: Request, res: Response): Promise<void> {
  const parsed = WebinarSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });
    return;
  }

  const existing = await prisma.webinar.findUnique({ where: { id: req.params.id as string } });
  if (!existing) {
    res.status(404).json({ message: "Webinar not found" });
    return;
  }

  const d = parsed.data;
  const nextTitle = d.title ?? existing.title;
  const nextDate = d.date ? new Date(d.date) : existing.date;
  const nextDurationMin = d.durationMin ?? existing.durationMin;
  const nextType = d.type ?? existing.type;

  let zoomChanges:
    | {
        zoomMeetingId?: string | null;
        zoomJoinUrl?: string | null;
        zoomStartUrl?: string | null;
        zoomPassword?: string | null;
      }
    | undefined;

  if (nextType === "LIVE" && !existing.zoomMeetingId) {
    try {
      const meeting = await createZoomMeeting({
        topic: nextTitle,
        startTime: nextDate,
        durationMin: nextDurationMin,
      });
      zoomChanges = {
        zoomMeetingId: meeting.id,
        zoomJoinUrl: meeting.join_url,
        zoomStartUrl: meeting.start_url,
        zoomPassword: meeting.password,
      };
    } catch (err) {
      console.error("Zoom meeting creation failed during update:", err);
    }
  }

  if (nextType === "RECORDED" && existing.zoomMeetingId) {
    try {
      await deleteZoomMeeting(existing.zoomMeetingId);
    } catch (err) {
      console.error("Zoom meeting deletion failed during update:", err);
    }

    zoomChanges = {
      zoomMeetingId: null,
      zoomJoinUrl: null,
      zoomStartUrl: null,
      zoomPassword: null,
    };
  }

  const updated = await prisma.webinar.update({
    where: { id: req.params.id as string },
    data: {
      ...(d.title !== undefined ? { title: d.title } : {}),
      ...(d.description !== undefined ? { description: d.description ?? null } : {}),
      ...(d.speaker !== undefined ? { speaker: d.speaker } : {}),
      ...(d.speakerBio !== undefined ? { speakerBio: d.speakerBio ?? null } : {}),
      ...(d.imageUrl !== undefined ? { imageUrl: d.imageUrl || null } : {}),
      ...(d.date !== undefined ? { date: new Date(d.date) } : {}),
      ...(d.durationMin !== undefined ? { durationMin: d.durationMin } : {}),
      ...(d.category !== undefined ? { category: d.category } : {}),
      ...(d.type !== undefined ? { type: d.type } : {}),
      ...(d.price !== undefined ? { price: d.price } : {}),
      ...(d.seats !== undefined ? { seats: d.seats } : {}),
      ...(d.isPublished !== undefined ? { isPublished: d.isPublished } : {}),
      ...(zoomChanges ?? {}),
    },
  });

  res.json({ message: "Webinar updated", webinar: updated });
}

// DELETE /api/admin/webinars/:id
export async function adminDeleteWebinar(req: Request, res: Response): Promise<void> {
  const existing = await prisma.webinar.findUnique({ where: { id: req.params.id as string } });
  if (!existing) {
    res.status(404).json({ message: "Webinar not found" });
    return;
  }

  // Delete Zoom meeting if one was created
  if (existing.zoomMeetingId) {
    try {
      await deleteZoomMeeting(existing.zoomMeetingId);
    } catch (err) {
      console.error("Zoom meeting deletion failed:", err);
    }
  }

  await prisma.webinar.delete({ where: { id: req.params.id as string } });
  res.json({ message: "Webinar deleted" });
}

// ─── User Management ─────────────────────────────────────────────────────────

// GET /api/admin/users
export async function adminListUsers(req: Request, res: Response): Promise<void> {
  const users = await prisma.user.findMany({
    where: { role: "USER" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { registrations: true } },
    },
  });
  res.json({ users });
}

// DELETE /api/admin/users/:id
export async function adminDeleteUser(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: req.params.id as string } });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  if (user.role === "ADMIN") {
    res.status(403).json({ message: "Cannot delete an admin user" });
    return;
  }
  await prisma.user.delete({ where: { id: req.params.id as string } });
  res.json({ message: "User deleted" });
}

// GET /api/admin/registrations
export async function adminListRegistrations(req: Request, res: Response): Promise<void> {
  const registrations = await prisma.registration.findMany({
    orderBy: { registeredAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      webinar: { select: { id: true, title: true, date: true } },
    },
  });
  res.json({ registrations });
}

// GET /api/admin/contacts
export async function adminListContacts(req: Request, res: Response): Promise<void> {
  const contacts = await prisma.contact.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ contacts });
}
