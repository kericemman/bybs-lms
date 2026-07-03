import { env } from "../config/env.js";
import { emailConfigured, sendEmail } from "./emailService.js";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function joinUrl(baseUrl, publicPath) {
  if (!baseUrl || !publicPath) return publicPath || "";
  return `${baseUrl.replace(/\/$/, "")}/${publicPath.replace(/^\//, "")}`;
}

function emailLogoSrc() {
  return env.emailLogoUrl || joinUrl(env.clientAdminUrl, "/assets/Logo1.png");
}

function firstName(user) {
  return user.name?.trim().split(/\s+/)[0] || user.email?.split("@")[0] || "there";
}

function portalUrl(role) {
  if (role === "mentor") return env.clientMentorUrl;
  if (role === "student") return env.clientStudentUrl;
  return env.clientAdminUrl;
}

function roleLabel(role) {
  const labels = {
    admin: "Admin",
    adminManager: "Admin Manager",
    mentor: "Mentor",
    student: "Student",
    superAdmin: "Super Admin"
  };

  return labels[role] || role;
}

function mergeLinks(overrides = {}) {
  return {
    websiteUrl: overrides.websiteUrl || env.publicWebsiteUrl,
    mentorWhatsappUrl: overrides.mentorWhatsappUrl || env.mentorWhatsappUrl,
    channelUrl: overrides.channelUrl || env.mentorChannelUrl,
    instagramUrl: overrides.instagramUrl || env.socialInstagramUrl,
    linkedInUrl: overrides.linkedInUrl || env.socialLinkedInUrl,
    youtubeUrl: overrides.youtubeUrl || env.socialYoutubeUrl,
    facebookUrl: overrides.facebookUrl || env.socialFacebookUrl
  };
}

function onboardingLinksForRole(role, links) {
  const mentorLinks = [
    {
      label: "Visit the BYBS website",
      href: links.websiteUrl,
      title: "Understand the mission",
      description:
        "Use the website to stay aligned with the BYBS promise, program positioning, and the bigger transformation students are working toward."
    },
    {
      label: "Join the mentors WhatsApp",
      href: links.mentorWhatsappUrl
    },
    {
      label: "Join the community channel",
      href: links.channelUrl
    },
    {
      label: "Follow on Instagram",
      href: links.instagramUrl
    },
    {
      label: "Connect on LinkedIn",
      href: links.linkedInUrl
    },
    {
      label: "Watch on YouTube",
      href: links.youtubeUrl
    },
    {
      label: "Follow on Facebook",
      href: links.facebookUrl
    }
  ];

  const defaultLinks = [
    {
      label: "Visit the BYBS website",
      href: links.websiteUrl,
      title: "Understand BYBS",
      description: "Use the website to understand the mission, program promise, and the community you are now supporting."
    },
    {
      label: "Join the community channel",
      href: links.channelUrl
    },
    {
      label: "Follow on Instagram",
      href: links.instagramUrl
    },
    {
      label: "Connect on LinkedIn",
      href: links.linkedInUrl
    },
    {
      label: "Watch on YouTube",
      href: links.youtubeUrl
    },
    {
      label: "Follow on Facebook",
      href: links.facebookUrl
    }
  ];

  return role === "mentor" ? mentorLinks : defaultLinks;
}

function onboardingWebsiteCard({ label, href, title, description }) {
  if (!href) return "";

  return `<div style="padding:14px 0 12px;border-top:1px solid #E5E7EB;">
      <p style="margin:0;color:#10233F;font-size:14px;font-weight:700;">${escapeHtml(title)}</p>
      <p style="margin:5px 0 10px;color:#374151;font-size:13px;line-height:1.6;">${escapeHtml(description)}</p>
      <a href="${escapeHtml(href)}" style="display:inline-block;background:#F5F9FF;color:#00337C;text-decoration:none;border:1px solid #E5E7EB;border-radius:6px;padding:9px 12px;font-size:13px;font-weight:700;">${escapeHtml(label)}</a>
    </div>`;
}

function compactLinkButton({ label, href }) {
  if (!href) return "";

  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:6px 6px 0 0;background:#FFFFFF;color:#00337C;text-decoration:none;border:1px solid #E5E7EB;border-radius:6px;padding:9px 11px;font-size:12px;font-weight:700;">${escapeHtml(label)}</a>`;
}

function onboardingSection(user, links) {
  const [websiteLink, ...compactLinks] = onboardingLinksForRole(user.role, links);
  const websiteCard = onboardingWebsiteCard(websiteLink);
  const buttons = compactLinks.map(compactLinkButton).join("");

  if (!websiteCard && !buttons) return "";

  return `<h2 style="margin:26px 0 8px;color:#10233F;font-size:16px;">Join the right BYBS spaces</h2>
    <p style="margin:0 0 8px;color:#374151;font-size:13px;line-height:1.6;">Each space supports a different part of the mentor journey, from official updates to quick coordination and student encouragement.</p>
    ${websiteCard}
    ${buttons ? `<div style="margin-top:4px;">${buttons}</div>` : ""}`;
}

function buildWelcomeHtml({ user, password, links }) {
  const logoSrc = emailLogoSrc();
  const loginUrl = portalUrl(user.role);

  return `<!doctype html>
<html>
  <body style="margin:0;background:#F7F9FC;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7F9FC;padding:24px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#00337C;padding:18px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="54" valign="middle" style="width:54px;vertical-align:middle;">
                      <table role="presentation" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border-radius:8px;">
                        <tr>
                          <td style="padding:5px;">
                            <img alt="BYBS" src="${escapeHtml(logoSrc)}" width="42" style="display:block;width:42px;height:auto;border:0;" />
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td valign="middle" style="color:#FFFFFF;vertical-align:middle;padding-left:12px;">
                      <div style="font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">Build Your Best Self</div>
                      <div style="margin-top:4px;font-size:20px;font-weight:700;">Welcome to BYBS LMS</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 10px;color:#10233F;font-size:24px;line-height:1.3;">Hi ${escapeHtml(firstName(user))}, your ${escapeHtml(roleLabel(user.role))} account is ready</h1>
                <p style="margin:0 0 18px;color:#374151;font-size:14px;line-height:1.7;">Use the login details below to access your BYBS learning workspace.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E5E7EB;border-radius:8px;margin:18px 0;">
                  <tr>
                    <td style="padding:12px;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:12px;text-transform:uppercase;">Login link</td>
                    <td style="padding:12px;border-bottom:1px solid #E5E7EB;"><a href="${escapeHtml(loginUrl)}" style="color:#00337C;font-weight:700;">${escapeHtml(loginUrl)}</a></td>
                  </tr>
                  <tr>
                    <td style="padding:12px;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:12px;text-transform:uppercase;">Email</td>
                    <td style="padding:12px;border-bottom:1px solid #E5E7EB;color:#10233F;font-weight:700;">${escapeHtml(user.email)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px;color:#6B7280;font-size:12px;text-transform:uppercase;">Temporary password</td>
                    <td style="padding:12px;color:#10233F;font-weight:700;">${escapeHtml(password)}</td>
                  </tr>
                </table>
                <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#00337C;color:#FFFFFF;text-decoration:none;border-radius:6px;padding:12px 16px;font-size:14px;font-weight:700;">Open BYBS LMS</a>
                ${onboardingSection(user, links)}
                <p style="margin:20px 0 0;color:#6B7280;font-size:12px;line-height:1.6;">For security, this is a temporary password. Keep it private and update it after first sign-in once password management is available.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#F5F9FF;border-top:1px solid #E5E7EB;padding:16px 28px;color:#6B7280;font-size:12px;line-height:1.5;">
                <strong style="color:#10233F;">BYBS LMS</strong><br />
                Build Your Best Self learning community.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendUserWelcomeEmail({ user, password, welcomeEmail = {} }) {
  if (welcomeEmail.send === false) {
    return { status: "notRequested" };
  }

  if (!emailConfigured()) {
    return { status: "notConfigured" };
  }

  const links = mergeLinks(welcomeEmail);

  try {
    await sendEmail({
      to: user.email,
      subject: `Your BYBS ${roleLabel(user.role)} login details`,
      html: buildWelcomeHtml({ user, password, links })
    });
  } catch (error) {
    return {
      status: "failed",
      error: error.message || "Welcome email provider request failed"
    };
  }

  return { status: "sent" };
}
