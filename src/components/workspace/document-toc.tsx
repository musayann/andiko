"use client"

import { useEffect, useMemo, useState, type RefObject } from "react"

import type { Heading } from "@/lib/markdown/types"
import { cn } from "@/lib/utils"

interface DocumentTocProps {
  headings: Heading[]
  scrollRef: RefObject<HTMLDivElement | null>
  articleRef: RefObject<HTMLElement | null>
}

const MAX_LEVEL = 3

/** Floating table of contents shown next to the document in View mode. */
export function DocumentToc({ headings, scrollRef, articleRef }: DocumentTocProps) {
  const items = useMemo(() => headings.filter((heading) => heading.level <= MAX_LEVEL), [headings])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const scroller = scrollRef.current
    const article = articleRef.current
    if (!scroller || !article || items.length === 0) return

    const update = () => {
      const threshold = scroller.getBoundingClientRect().top + 32
      let current: string | null = items[0].id
      for (const item of items) {
        const el = article.querySelector(`[id="${CSS.escape(item.id)}"]`)
        if (el && el.getBoundingClientRect().top <= threshold) current = item.id
      }
      setActiveId(current)
    }
    update()
    scroller.addEventListener("scroll", update, { passive: true })
    return () => scroller.removeEventListener("scroll", update)
  }, [items, scrollRef, articleRef])

  if (items.length === 0) return null

  const minLevel = Math.min(...items.map((item) => item.level))

  return (
    <nav aria-label="Table of contents" className="hidden w-56 shrink-0 xl:block">
      <div className="sticky top-8 max-h-[calc(100svh-8rem)] overflow-y-auto border-l py-1 text-sm">
        <p className="mb-2 pl-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">On this page</p>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(event) => {
                  event.preventDefault()
                  articleRef.current
                    ?.querySelector(`[id="${CSS.escape(item.id)}"]`)
                    ?.scrollIntoView({ behavior: "smooth" })
                }}
                style={{ paddingLeft: `${(item.level - minLevel) * 12 + 16}px` }}
                className={cn(
                  "-ml-px block border-l border-transparent py-1 pr-2 leading-snug text-muted-foreground transition-colors hover:text-foreground",
                  activeId === item.id && "border-foreground font-medium text-foreground",
                )}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
