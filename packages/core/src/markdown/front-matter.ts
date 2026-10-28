import { parse } from "yaml"

import type { DocMeta } from "./types"

function toTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  }
  return []
}

export function parseFrontMatter(raw: string | null): DocMeta {
  if (!raw) return { tags: [] }
  let data: unknown
  try {
    data = parse(raw)
  } catch {
    return { tags: [] }
  }
  if (!data || typeof data !== "object") return { tags: [] }

  const record = data as Record<string, unknown>
  return {
    title: typeof record.title === "string" ? record.title : undefined,
    description: typeof record.description === "string" ? record.description : undefined,
    tags: toTags(record.tags),
    breaks: typeof record.breaks === "boolean" ? record.breaks : undefined,
  }
}
