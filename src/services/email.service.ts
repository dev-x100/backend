import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? "587", 10),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<void> {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? "dev-x100 <noreply@dev-x100.com>",
    to,
    subject,
    html,
  });
}

// ─── Templates ────────────────────────────────────────────────────────────────

function base(content: string): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body { font-family: 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
      .container { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
      .header { background: #002e6d; padding: 32px 40px; text-align: center; }
      .header h1 { color: #fff; margin: 0; font-size: 24px; }
      .header span { color: #f59e0b; }
      .body { padding: 32px 40px; }
      .footer { background: #f1f5f9; padding: 20px 40px; text-align: center; font-size: 12px; color: #64748b; }
      .btn { display: inline-block; margin-top: 24px; padding: 14px 32px; background: #f59e0b; color: #1e293b; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; }
      .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 20px 0; }
      .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
      .info-row:last-child { border-bottom: none; }
      .label { color: #64748b; }
      .value { font-weight: 600; color: #1e293b; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>dev-x<span>100</span></h1>
      </div>
      <div class="body">${content}</div>
      <div class="footer">
        © ${new Date().getFullYear()} dev-x100 · Professional Webinar Platform<br/>
        4283 Express Lane, Sarasota, FL 34249 · support@dev-x100.com
      </div>
    </div>
  </body>
  </html>`;
}

export function paymentConfirmationEmail(opts: {
  userName: string;
  webinarTitle: string;
  speaker: string;
  date: Date;
  amount: number;
  zoomJoinUrl: string;
  zoomPassword?: string;
}): string {
  return base(`
    <h2 style="color:#002e6d;margin-top:0">🎉 You're registered!</h2>
    <p>Hi <strong>${opts.userName}</strong>, your payment was successful and your spot is confirmed.</p>
    <div class="info-box">
      <div class="info-row"><span class="label">Webinar</span><span class="value">${opts.webinarTitle}</span></div>
      <div class="info-row"><span class="label">Speaker</span><span class="value">${opts.speaker}</span></div>
      <div class="info-row"><span class="label">Date</span><span class="value">${opts.date.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}</span></div>
      <div class="info-row"><span class="label">Amount Paid</span><span class="value">$${opts.amount.toFixed(2)}</span></div>
      ${opts.zoomPassword ? `<div class="info-row"><span class="label">Zoom Password</span><span class="value">${opts.zoomPassword}</span></div>` : ""}
    </div>
    <p>Use the button below to join your webinar on the day:</p>
    <a href="${opts.zoomJoinUrl}" class="btn">Join Zoom Webinar →</a>
    <p style="margin-top:24px;font-size:13px;color:#64748b">Save this email — the Zoom link will only work for registered attendees.</p>
  `);
}

export function reminderEmail(opts: {
  userName: string;
  webinarTitle: string;
  speaker: string;
  date: Date;
  zoomJoinUrl: string;
  hoursUntil: number;
}): string {
  return base(`
    <h2 style="color:#002e6d;margin-top:0">⏰ Your webinar starts in ${opts.hoursUntil} hour${opts.hoursUntil !== 1 ? "s" : ""}!</h2>
    <p>Hi <strong>${opts.userName}</strong>, just a reminder that your upcoming webinar is almost here.</p>
    <div class="info-box">
      <div class="info-row"><span class="label">Webinar</span><span class="value">${opts.webinarTitle}</span></div>
      <div class="info-row"><span class="label">Speaker</span><span class="value">${opts.speaker}</span></div>
      <div class="info-row"><span class="label">Date</span><span class="value">${opts.date.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}</span></div>
    </div>
    <a href="${opts.zoomJoinUrl}" class="btn">Join Zoom Now →</a>
  `);
}

export function welcomeEmail(opts: { userName: string }): string {
  return base(`
    <h2 style="color:#002e6d;margin-top:0">Welcome to dev-x100! 🎓</h2>
    <p>Hi <strong>${opts.userName}</strong>, your account has been created successfully.</p>
    <p>You can now browse our library of compliance, HR, and regulatory webinars — live and on-demand.</p>
    <a href="${process.env.FRONTEND_URL}/webinars" class="btn">Browse Webinars →</a>
  `);
}
