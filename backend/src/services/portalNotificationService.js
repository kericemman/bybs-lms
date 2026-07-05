import { env } from "../config/env.js";
import { Notification } from "../models/Notification.js";
import { sanitizePlainText } from "../utils/sanitizeRichText.js";
import { buildAnnouncementEmailHtml } from "./announcementEmailService.js";
import { emailConfigured, sendEmail } from "./emailService.js";

const emailChannels = new Set(["email", "both"]);

function firstName(user) {
  return user?.name?.trim().split(/\s+/)[0] || user?.email?.split("@")[0] || "there";
}

function portalBaseUrl(role = "") {
  if (role === "mentor") return env.clientMentorUrl;
  if (role === "student") return env.clientStudentUrl;
  return env.clientAdminUrl;
}

function absoluteCtaUrl(ctaUrl = "", role = "") {
  if (!ctaUrl) return "";

  try {
    return new URL(ctaUrl).toString();
  } catch {
    return `${portalBaseUrl(role).replace(/\/$/, "")}/${String(ctaUrl).replace(/^\//, "")}`;
  }
}

function initialEmailStatus(channel) {
  if (!emailChannels.has(channel)) return "notRequested";
  return emailConfigured() ? "pending" : "notConfigured";
}

function emailMessage(notification) {
  const plainMessage = sanitizePlainText(notification.templateMessage || notification.message || "");
  return plainMessage || notification.previewText || notification.title;
}

async function sendNotificationEmail({ notification, recipient, portalRole }) {
  if (!emailChannels.has(notification.channel)) {
    return { status: "notRequested" };
  }

  if (!emailConfigured()) {
    return { status: "notConfigured" };
  }

  if (!recipient?.email) {
    return { status: "failed", error: "Recipient email is missing" };
  }

  try {
    const targetRole = portalRole || notification.targetRole || recipient.role;
    const html = buildAnnouncementEmailHtml({
      title: notification.templateTitle || notification.title,
      previewText: notification.templatePreviewText || notification.previewText,
      message: emailMessage(notification),
      type: notification.type || "system",
      ctaLabel: notification.ctaLabel,
      ctaUrl: absoluteCtaUrl(notification.ctaUrl, targetRole),
      recipientName: firstName(recipient)
    });

    await sendEmail({
      to: recipient.email,
      subject: notification.templateTitle || notification.title,
      html
    });

    return { status: "sent", sentAt: new Date() };
  } catch (error) {
    return {
      status: "failed",
      error: error.message?.slice(0, 300) || "Email delivery failed"
    };
  }
}

async function updateEmailDelivery(notification, delivery) {
  notification.emailDeliveryStatus = delivery.status;
  notification.emailDeliveryError = delivery.error;
  notification.emailSentAt = delivery.sentAt;
  await notification.save();
  return notification;
}

async function runLimited(items, worker, limit = 5) {
  const results = [];
  let index = 0;

  async function run() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export async function notifyUser({ recipient, notification, portalRole }) {
  const channel = notification.channel || "both";
  const createdNotification = await Notification.create({
    ...notification,
    recipient: recipient._id || recipient,
    channel,
    emailDeliveryStatus: initialEmailStatus(channel)
  });

  const delivery = await sendNotificationEmail({
    notification: createdNotification,
    recipient,
    portalRole
  });

  return updateEmailDelivery(createdNotification, delivery);
}

export async function notifyUserOnce({ recipient, notification, portalRole, uniqueKey }) {
  if (!uniqueKey) {
    return { notification: await notifyUser({ recipient, notification, portalRole }), created: true };
  }

  const channel = notification.channel || "both";
  const result = await Notification.findOneAndUpdate(
    {
      recipient: recipient._id || recipient,
      announcementId: uniqueKey
    },
    {
      $setOnInsert: {
        ...notification,
        announcementId: uniqueKey,
        recipient: recipient._id || recipient,
        channel,
        emailDeliveryStatus: initialEmailStatus(channel)
      }
    },
    {
      new: true,
      upsert: true,
      includeResultMetadata: true,
      setDefaultsOnInsert: true
    }
  );
  const createdNotification = result.value;
  const created = !result.lastErrorObject?.updatedExisting;

  if (!created) {
    return { notification: createdNotification, created: false };
  }

  const delivery = await sendNotificationEmail({
    notification: createdNotification,
    recipient,
    portalRole
  });

  return {
    notification: await updateEmailDelivery(createdNotification, delivery),
    created: true
  };
}

export async function notifyUsers({ recipients, notification, portalRole }) {
  const channel = notification.channel || "both";
  const notifications = await Notification.insertMany(
    recipients.map((recipient) => ({
      ...notification,
      recipient: recipient._id || recipient,
      channel,
      emailDeliveryStatus: initialEmailStatus(channel)
    }))
  );

  const deliveries = await runLimited(
    notifications,
    async (createdNotification, index) => {
      const delivery = await sendNotificationEmail({
        notification: createdNotification,
        recipient: recipients[index],
        portalRole
      });
      await updateEmailDelivery(createdNotification, delivery);
      return delivery;
    },
    5
  );

  return {
    notifications,
    sent: deliveries.filter((delivery) => delivery.status === "sent").length,
    failed: deliveries.filter((delivery) => delivery.status === "failed").length,
    notConfigured: deliveries.filter((delivery) => delivery.status === "notConfigured").length
  };
}
