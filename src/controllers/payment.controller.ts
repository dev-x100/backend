import Stripe from "stripe";
import { Request, Response } from "express";
import prisma from "../db/client";
import { sendEmail, paymentConfirmationEmail } from "../services/email.service";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// POST /api/payments/checkout  — create Stripe checkout session
export async function createCheckoutSession(req: Request, res: Response): Promise<void> {
  const { webinarId } = req.body;
  const userId = req.user!.userId;

  if (!webinarId) {
    res.status(400).json({ message: "webinarId is required" });
    return;
  }

  const webinar = await prisma.webinar.findUnique({
    where: { id: webinarId, isPublished: true },
    include: { _count: { select: { registrations: true } } },
  });

  if (!webinar) {
    res.status(404).json({ message: "Webinar not found" });
    return;
  }

  if (webinar._count.registrations >= webinar.seats) {
    res.status(409).json({ message: "Webinar is fully booked" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  // Upsert a PENDING registration
  const registration = await prisma.registration.upsert({
    where: { userId_webinarId: { userId, webinarId } },
    update: {},
    create: { userId, webinarId, paymentStatus: "PENDING" },
  });

  // Free webinar — mark paid directly, no Stripe session needed
  if (Number(webinar.price) === 0) {
    await prisma.registration.update({
      where: { id: registration.id },
      data: { paymentStatus: "PAID", paidAt: new Date(), amountPaid: 0 },
    });
    res.json({ free: true, message: "Registered for free webinar" });
    return;
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: webinar.title,
            description: `Speaker: ${webinar.speaker} · ${new Date(webinar.date).toLocaleDateString()}`,
          },
          unit_amount: Math.round(Number(webinar.price) * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      registrationId: registration.id,
      userId,
      webinarId,
    },
    success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/webinars/${webinarId}?payment=cancelled`,
  });

  // Save session ID against the registration
  await prisma.registration.update({
    where: { id: registration.id },
    data: { stripeSessionId: session.id },
  });

  res.json({ url: session.url });
}

// POST /api/payments/webhook  — Stripe webhook to confirm payment
export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;
  try {
    // req.body must be the raw buffer here (see app.ts rawBody config)
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Webhook signature failed";
    res.status(400).json({ message: msg });
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { registrationId, userId, webinarId } = session.metadata ?? {};

    if (!registrationId || !userId || !webinarId) {
      res.status(400).json({ message: "Missing metadata" });
      return;
    }

    const [registration, webinar, user] = await Promise.all([
      prisma.registration.findUnique({ where: { id: registrationId } }),
      prisma.webinar.findUnique({ where: { id: webinarId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    ]);

    if (!registration || !webinar || !user) {
      res.status(404).json({ message: "Record not found" });
      return;
    }

    // Mark as PAID
    await prisma.registration.update({
      where: { id: registrationId },
      data: {
        paymentStatus: "PAID",
        stripePaymentId: session.payment_intent as string,
        amountPaid: session.amount_total ? session.amount_total / 100 : webinar.price,
        paidAt: new Date(),
      },
    });

    // Send confirmation email with Zoom link (if available)
    const zoomLink = webinar.zoomJoinUrl ?? `${process.env.FRONTEND_URL}/webinars/${webinarId}`;
    try {
      await sendEmail({
        to: user.email,
        subject: `✅ Registration confirmed: ${webinar.title}`,
        html: paymentConfirmationEmail({
          userName: user.name,
          webinarTitle: webinar.title,
          speaker: webinar.speaker,
          date: new Date(webinar.date),
          amount: session.amount_total ? session.amount_total / 100 : Number(webinar.price),
          zoomJoinUrl: zoomLink,
          zoomPassword: webinar.zoomPassword ?? undefined,
        }),
      });
    } catch (emailErr) {
      console.error("Email send failed:", emailErr);
      // Don't fail the webhook — payment is confirmed
    }
  }

  res.json({ received: true });
}

// GET /api/payments/session/:id  — verify a completed Stripe session from the success page
export async function verifySession(req: Request, res: Response): Promise<void> {
  const session = await stripe.checkout.sessions.retrieve(req.params.id as string);

  if (!session || session.payment_status !== "paid") {
    res.status(400).json({ message: "Payment not confirmed" });
    return;
  }

  const { registrationId } = session.metadata ?? {};
  if (!registrationId) {
    res.status(400).json({ message: "Missing metadata" });
    return;
  }

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      webinar: { select: { id: true, title: true, date: true, zoomJoinUrl: true, speaker: true } },
    },
  });

  res.json({ registration });
}
