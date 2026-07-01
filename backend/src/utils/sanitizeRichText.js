import sanitizeHtml from "sanitize-html";

const richTextOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "figure",
    "figcaption",
    "h1",
    "h2",
    "h3",
    "img",
    "span",
    "u"
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    img: ["alt", "height", "src", "title", "width"],
    span: ["class"],
    p: ["class"],
    h1: ["class"],
    h2: ["class"],
    h3: ["class"]
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"]
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
      target: "_blank"
    })
  }
};

export function sanitizeRichText(value = "") {
  return sanitizeHtml(String(value || ""), richTextOptions).trim();
}

export function sanitizePlainText(value = "") {
  return sanitizeHtml(String(value || ""), {
    allowedTags: [],
    allowedAttributes: {}
  }).trim();
}
