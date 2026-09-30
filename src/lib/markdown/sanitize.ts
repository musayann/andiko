import DOMPurify from "dompurify"

const HEADING = /^H[1-6]$/
const SAFE_ID = /^[\p{L}\p{N}_-]+$/u

let hooksInstalled = false

function installHooks() {
  // DOMPurify drops ids that shadow DOM properties (e.g. a heading "Title"
  // becomes id="title"). Heading slugs we generate are safe to keep.
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if (data.attrName === "id" && HEADING.test(node.nodeName) && SAFE_ID.test(data.attrValue)) {
      data.forceKeepAttr = true
    }
  })
  hooksInstalled = true
}

/** Sanitizes rendered Markdown. Browser only (DOMPurify needs a DOM). */
export function sanitizeHtml(html: string): string {
  if (!hooksInstalled) installHooks()
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, mathMl: true },
    // raw <style> would restyle the whole app, not just the document
    FORBID_TAGS: ["style"],
  })
}
