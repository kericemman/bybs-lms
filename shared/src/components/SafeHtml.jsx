import DOMPurify from "dompurify";
import { useMemo } from "react";
import { cn } from "../lib/cn.js";

const safeHtmlClassName =
  "min-w-0 max-w-full break-words [overflow-wrap:anywhere] [&_a]:break-words [&_a]:[overflow-wrap:anywhere] [&_img]:h-auto [&_img]:max-w-full [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto";

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
    return <div className={cn("whitespace-pre-line", safeHtmlClassName, className)}>{html}</div>;
  }

  return <div className={cn(safeHtmlClassName, className)} dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
}
