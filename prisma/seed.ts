import { PrismaClient, Role, WebinarType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱  Seeding database...");

  // ── Admin user ─────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("Admin@1234", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@tunudada.com" },
    update: {},
    create: {
      name: "TunuDada Admin",
      email: "admin@tunudada.com",
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });
  console.log(`✅  Admin user: ${admin.email}`);

  // ── Demo user ──────────────────────────────────────────────────────────────
  const userPassword = await bcrypt.hash("User@1234", 12);
  const demoUser = await prisma.user.upsert({
    where: { email: "user@tunudada.com" },
    update: {},
    create: {
      name: "Jane Doe",
      email: "user@tunudada.com",
      passwordHash: userPassword,
      role: Role.USER,
    },
  });
  console.log(`✅  Demo user: ${demoUser.email}`);

  // ── Webinars ───────────────────────────────────────────────────────────────
  const webinars = [
    {
      title: "PTO or Sick Vacation With Mandatory Paid Leave",
      description:
        "Deep-dive into PTO vs. sick leave policies, legal obligations, and what new mandatory paid leave laws mean for your organization.",
      speaker: "Bob McKenzie",
      speakerBio: "HR Expert and Author with 30+ years in benefits strategy.",
      category: "HR & Benefits",
      type: WebinarType.LIVE,
      date: new Date("2026-05-15T14:00:00Z"),
      price: 149,
      seats: 200,
    },
    {
      title: "How to Document Employee Behavior",
      description:
        "Practical templates and best practices for documenting performance issues, disciplinary actions, and workplace incidents.",
      speaker: "Suzanne Lucas",
      speakerBio: "The Evil HR Lady — writer, speaker, and consultant.",
      category: "HR & Employee Relations",
      type: WebinarType.LIVE,
      date: new Date("2026-05-22T15:00:00Z"),
      price: 129,
      seats: 150,
    },
    {
      title: "Onboarding Is Not Orientation — Smart Start Onboarding",
      description:
        "Build a structured first-90-days onboarding plan that accelerates productivity and reduces early turnover.",
      speaker: "Marcia Zidle",
      speakerBio: "Executive coach and leadership strategist.",
      category: "HR & Employee Relations",
      type: WebinarType.LIVE,
      date: new Date("2026-06-03T13:00:00Z"),
      price: 149,
      seats: 100,
    },
    {
      title: "Retaliation and Whistleblower Claims: Best Practices",
      description:
        "Navigate legal exposure from retaliation claims — case studies, policies, and proactive prevention steps.",
      speaker: "Susan Fahey Desmond",
      speakerBio: "Employment law attorney and partner at Jackson Lewis.",
      category: "Regulatory & Legal",
      type: WebinarType.LIVE,
      date: new Date("2026-06-10T14:00:00Z"),
      price: 179,
      seats: 120,
    },
    {
      title: "Cannabis in the Workplace: Has the U.S. Gone to Pot",
      description:
        "State-by-state breakdown of cannabis laws and how to craft a drug policy that protects your business.",
      speaker: "Don Phin",
      speakerBio: "HR strategist and employment attorney.",
      category: "Regulatory & Legal",
      type: WebinarType.RECORDED,
      date: new Date("2026-04-01T00:00:00Z"),
      price: 99,
      seats: 999,
    },
    {
      title: "How to Effectively Use Pre-Hire Assessments",
      description:
        "Choose, validate, and interpret pre-hire assessments to make better hiring decisions and reduce bias.",
      speaker: "Dr. B. Lynn Ware",
      speakerBio: "I/O psychologist and CEO of Integral Talent Systems.",
      category: "HR & Employee Relations",
      type: WebinarType.RECORDED,
      date: new Date("2026-03-19T00:00:00Z"),
      price: 89,
      seats: 999,
    },
    {
      title: "Stay Interviews: A Powerful Retention Tool",
      description:
        "Script and run stay interviews that reveal why your top talent stays — and what might make them leave.",
      speaker: "Melveen Stevenson",
      speakerBio: "HR executive and certified coach.",
      category: "Operations & Leadership",
      type: WebinarType.LIVE,
      date: new Date("2026-06-24T15:00:00Z"),
      price: 129,
      seats: 80,
    },
    {
      title: "Linking Pay to Performance",
      description:
        "Design pay-for-performance systems that actually motivate employees without breaking your compensation budget.",
      speaker: "Diane L. Dee",
      speakerBio: "SPHR-certified consultant and compensation strategist.",
      category: "HR & Benefits",
      type: WebinarType.LIVE,
      date: new Date("2026-07-08T14:00:00Z"),
      price: 149,
      seats: 100,
    },
  ];

  for (const w of webinars) {
    await prisma.webinar.upsert({
      where: {
        id: Buffer.from(w.title).toString("base64").slice(0, 36).padEnd(36, "0"),
      },
      update: {},
      create: {
        ...w,
        id: Buffer.from(w.title).toString("base64").slice(0, 36).padEnd(36, "0"),
        createdById: admin.id,
      },
    });
  }

  console.log(`✅  ${webinars.length} webinars seeded`);
  console.log("\n🚀  Seed complete!");
  console.log("   Admin  →  admin@tunudada.com  /  Admin@1234");
  console.log("   User   →  user@tunudada.com   /  User@1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
