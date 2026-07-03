import { SafeHtml } from "@bybs/shared";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeHref(value = "") {
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function renderInlineMarkdown(value = "") {
  const escaped = escapeHtml(value);

  return escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const href = safeHref(url);
    return href ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank">${escapeHtml(label)}</a>` : match;
  });
}

function containsHtml(value = "") {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function instructionsToHtml(value = "") {
  const source = String(value || "").trim();
  if (!source) return "";

  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const output = [];
  let listOpen = false;

  function closeList() {
    if (!listOpen) return;
    output.push("</ul>");
    listOpen = false;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }

    const heading = trimmed.match(/^#{2,3}\s+(.+)$/);
    if (heading) {
      closeList();
      output.push(`<h2>${renderInlineMarkdown(heading[1].trim())}</h2>`);
      continue;
    }

    const bullet = trimmed.match(/^-\s+(.+)$/);
    if (bullet) {
      if (!listOpen) {
        output.push("<ul>");
        listOpen = true;
      }
      output.push(`<li>${renderInlineMarkdown(bullet[1].trim())}</li>`);
      continue;
    }

    closeList();
    output.push(containsHtml(trimmed) ? trimmed : `<p>${renderInlineMarkdown(trimmed)}</p>`);
  }

  closeList();
  return output.join("\n");
}

export function AssignmentInstructions({ instructions }) {
  return (
    <SafeHtml
      className={[
        "mt-5 rounded-md bg-bybs-pale p-4 text-sm leading-6 text-bybs-body",
        "[&_a]:font-medium [&_a]:text-bybs-blue [&_a]:underline",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-bybs-rose [&_blockquote]:bg-bybs-blush [&_blockquote]:px-4 [&_blockquote]:py-2",
        "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2:first-child]:mt-0 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-bybs-navy",
        "[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-bybs-blue",
        "[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-md [&_img]:border [&_img]:border-bybs-border",
        "[&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1",
        "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1"
      ].join(" ")}
      html={instructionsToHtml(instructions)}
    />
  );
}
