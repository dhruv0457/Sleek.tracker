import nodemailer from "nodemailer";

let cachedTransport: nodemailer.Transporter | null = null;

export function getMailer(): nodemailer.Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });
  return cachedTransport;
}

export async function sendMail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  const mailer = getMailer();
  const fromUser = process.env.GMAIL_USER || "no-reply@sleek.local";
  if (!mailer) {
    console.warn("[mailer] GMAIL_USER or GMAIL_APP_PASSWORD missing — skipping send to", to);
    // DEV MODE: Log the email content so you can test without real SMTP
    if (process.env.NODE_ENV !== "production") {
      console.log("═══════════════════════════════════════");
      console.log(`[DEV EMAIL TO: ${to}]`);
      console.log(`Subject: ${subject}`);
      console.log(`Body:\n${text}`);
      console.log("═══════════════════════════════════════");
    }
    return false;
  }
  try {
    await mailer.sendMail({ from: `sleek <${fromUser}>`, to, subject, text, html });
    return true;
  } catch (e: any) {
    console.error("[mailer] send error", e?.message || e);
    return false;
  }
}

export function morningAgendaEmail(toName: string, habitList: string[]): { subject: string; text: string } {
  const subject = "☀️ Today's Agenda from sleek";
  const text = `Good morning ${toName || "friend"}!\n\nHere are your tasks for today:\n${habitList.map((h) => `• ${h}`).join("\n")}\n\nStay consistent — never miss twice.\n— sleek`;
  return { subject, text };
}

export function eveningSummaryEmail(toName: string, doneHabs: string[], missHabs: string[]): { subject: string; text: string } {
  const subject = "🌙 End of Day Report from sleek";
  const text = `Hi ${toName || "friend"},\n\nDaily wrap-up:\nCompleted (${doneHabs.length}):\n${doneHabs.map((h) => `• ${h}`).join("\n")}\n\nMissed (${missHabs.length}):\n${missHabs.map((h) => `• ${h}`).join("\n")}\n\nReflect, rest, repeat tomorrow.\n— sleek`;
  return { subject, text };
}

export function reminderEmail(toName: string, label: string, time: string): { subject: string; text: string } {
  const subject = `⏰ Reminder: ${label}`;
  const text = `Hey ${toName || ""}, it's ${time}. Time for: ${label}.\n\n— sleek`;
  return { subject, text };
}
