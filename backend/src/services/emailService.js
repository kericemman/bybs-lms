import nodemailer from "nodemailer";
import { env } from "../config/env.js";

let smtpTransporter = null;

function smtpConfigured() {
  return Boolean(env.smtpHost);
}

function smtpAuth() {
  if (!env.smtpUser && !env.smtpPass) return undefined;

  return {
    user: env.smtpUser,
    pass: env.smtpPass
  };
}

function transporter() {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure,
      auth: smtpAuth()
    });
  }

  return smtpTransporter;
}

async function sendResendEmail({ to, subject, html }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to,
      subject,
      html
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Email failed with status ${response.status}: ${body.slice(0, 300)}`);
  }
}

export function emailConfigured() {
  return smtpConfigured() || Boolean(env.resendApiKey);
}

export async function sendEmail({ to, subject, html }) {
  if (smtpConfigured()) {
    await transporter().sendMail({
      from: env.emailFrom,
      to,
      subject,
      html
    });
    return;
  }

  if (env.resendApiKey) {
    await sendResendEmail({ to, subject, html });
    return;
  }

  throw new Error("Email provider is not configured");
}
