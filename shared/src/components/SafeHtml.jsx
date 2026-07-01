import DOMPurify from "dompurify";
import { useMemo } from "react";

function hasHtml(value = "") {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function purifier() {
  if (typeof DOMPurify?.sanitize === "function") {
    return DOMPurify;
  }

  if (typeof DOMPurify === "function" && typeof window !== "undefined") {
    return DOMPurify(window);
  }

  return null;
}

function sanitize(value, options) {
  const activePurifier = purifier();
  return activePurifier?.sanitize ? activePurifier.sanitize(value, options) : String(value || "");
}

export function SafeHtml({ html = "", className = "" }) {
  const sanitizedHtml = useMemo(
    () => sanitize(String(html || ""), {
      USE_PROFILES: { html: true },
      ADD_ATTR: ["target", "rel"]
    }),
    [html]
  );

  if (!hasHtml(html)) {
    return <div className={`whitespace-pre-line ${className}`.trim()}>{html}</div>;
  }

  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
}
