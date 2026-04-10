import prisma from "../db/client";
import { reminderEmail, sendEmail } from "./email.service";

let reminderTimer: NodeJS.Timeout | null = null;
let reminderRunInProgress = false;

async function processUpcomingReminders(): Promise<void> {
  if (reminderRunInProgress) {
    return;
  }

  reminderRunInProgress = true;

  try {
    const reminderWindowHours = parseInt(process.env.REMINDER_WINDOW_HOURS ?? "24", 10);
    const now = new Date();
    const upperBound = new Date(now.getTime() + reminderWindowHours * 60 * 60 * 1000);

    const registrations = await prisma.registration.findMany({
      where: {
        paymentStatus: "PAID",
        reminderSentAt: null,
        webinar: {
          type: "LIVE",
          isPublished: true,
          date: {
            gte: now,
            lte: upperBound,
          },
        },
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        webinar: {
          select: {
            id: true,
            title: true,
            speaker: true,
            date: true,
            zoomJoinUrl: true,
          },
        },
      },
    });

    for (const registration of registrations) {
      const webinarDate = new Date(registration.webinar.date);
      const hoursUntil = Math.max(1, Math.round((webinarDate.getTime() - now.getTime()) / 3600000));
      const joinUrl = registration.webinar.zoomJoinUrl ?? `${process.env.FRONTEND_URL}/webinars/${registration.webinar.id}`;

      try {
        await sendEmail({
          to: registration.user.email,
          subject: `Reminder: ${registration.webinar.title} starts soon`,
          html: reminderEmail({
            userName: registration.user.name,
            webinarTitle: registration.webinar.title,
            speaker: registration.webinar.speaker,
            date: webinarDate,
            zoomJoinUrl: joinUrl,
            hoursUntil,
          }),
        });

        await prisma.registration.update({
          where: { id: registration.id },
          data: { reminderSentAt: new Date() },
        });
      } catch (err) {
        console.error(`Reminder email failed for registration ${registration.id}:`, err);
      }
    }
  } finally {
    reminderRunInProgress = false;
  }
}

export function startReminderScheduler(): void {
  if ((process.env.REMINDER_ENABLED ?? "true").toLowerCase() === "false") {
    console.log("Reminder scheduler disabled.");
    return;
  }

  if (reminderTimer) {
    return;
  }

  const intervalMinutes = Math.max(1, parseInt(process.env.REMINDER_INTERVAL_MINUTES ?? "15", 10));
  console.log(`Reminder scheduler started. Checking every ${intervalMinutes} minute(s).`);

  void processUpcomingReminders();
  reminderTimer = setInterval(() => {
    void processUpcomingReminders();
  }, intervalMinutes * 60 * 1000);
}