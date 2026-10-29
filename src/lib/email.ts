import nodemailer from "nodemailer";

export function emailEnabled() {
  return Boolean(process.env.SMTP_HOST);
}

function transport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export async function sendInviteEmail(opts: {
  to: string;
  inviterName: string;
  tripName: string;
  link: string;
}) {
  if (!emailEnabled()) return;
  const { to, inviterName, tripName, link } = opts;
  await transport().sendMail({
    from: process.env.EMAIL_FROM ?? process.env.SMTP_USER,
    to,
    subject: `${inviterName} invited you to "${tripName}" on TripSplit`,
    text:
      `${inviterName} invited you to join "${tripName}" on TripSplit, where the group tracks shared trip expenses.\n\n` +
      `Join here: ${link}\n\nSign in with Google using ${to} and the trip will appear automatically.`,
    html:
      `<p>${escapeHtml(inviterName)} invited you to join <strong>${escapeHtml(tripName)}</strong> on TripSplit, where the group tracks shared trip expenses.</p>` +
      `<p><a href="${escapeHtml(link)}">Join the trip</a></p>` +
      `<p style="color:#666">Sign in with Google using ${escapeHtml(to)} and the trip will appear automatically.</p>`,
  });
}
