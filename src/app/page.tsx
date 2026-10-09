import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRightIcon,
  Columns2Icon,
  FileDownIcon,
  FolderTreeIcon,
  KeyboardIcon,
  MessageSquareWarningIcon,
  MoonStarIcon,
  ShieldCheckIcon,
  SigmaIcon,
  WorkflowIcon,
} from "lucide-react"

import { LogoMark } from "@/components/logo"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { Button } from "@/components/ui/button"
import { privacyPolicy, repoUrl, siteDescription, siteName, siteUrl } from "@/lib/site"
import { cn } from "@/lib/utils"

// Returning visitors never see this page: src/proxy.ts sends them back to their last document.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
}

// every section lines up with the header: same max width, same side padding
const container = "mx-auto w-full max-w-5xl px-4 sm:px-6"

const screenshotAlt =
  "The Andiko editor in split view: Markdown with LaTeX and Mermaid code on the left, rendered KaTeX equations, a flowchart and a sequence diagram on the right."

const features = [
  {
    icon: Columns2Icon,
    title: "Live preview, side by side",
    text: "Edit, Split and View modes with a resizable divider. The editor and the preview stay scroll-synced as you type.",
  },
  {
    icon: SigmaIcon,
    title: "KaTeX maths",
    text: "Inline $…$ and display $$…$$ equations, rendered instantly with KaTeX.",
  },
  {
    icon: WorkflowIcon,
    title: "Mermaid diagrams",
    text: "Flowcharts, sequence diagrams, Gantt charts and more, drawn from plain-text code blocks.",
  },
  {
    icon: FileDownIcon,
    title: "Markdown to PDF",
    text: "A real PDF rendered by headless Chrome, with selectable text, embedded fonts and page numbers.",
  },
  {
    icon: MessageSquareWarningIcon,
    title: "Extended Markdown",
    text: "Alert boxes, spoilers, footnotes, task lists, a table of contents, definition lists, emoji and YAML front matter.",
  },
  {
    icon: KeyboardIcon,
    title: "Formatting bar and shortcuts",
    text: "Buttons for headings, tables, links, code blocks and more, plus the keyboard shortcuts you already know.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Private by design",
    text: "No account and no cloud storage. Your documents are saved in your own browser, and only the ones you share are uploaded.",
  },
  {
    icon: FolderTreeIcon,
    title: "Folders, import and export",
    text: "Organise documents in nested folders. Import .md files or .zip archives and export everything back.",
  },
  {
    icon: MoonStarIcon,
    title: "Light and dark themes",
    text: "Follows your system setting, or pick one. Code blocks get syntax highlighting in both.",
  },
]

const faqs = [
  {
    question: "Is Andiko free?",
    answer:
      "Yes. Andiko is free to use and open source under the MIT License. There are no paid plans, no ads and no sign-up.",
  },
  {
    question: "Do I need an account?",
    answer: "No. Open the editor and start typing. There is nothing to sign up for.",
  },
  {
    question: "Where are my documents stored?",
    answer:
      "In your browser, using IndexedDB. They are not uploaded unless you share one: a shared document is stored on the server so anyone with its link can read it, until you stop sharing. PDF export also sends the rendered document to the server to create the PDF, and it is not kept. Clearing your browser data deletes your documents, so export anything you want to keep.",
  },
  {
    question: "Can I share a document?",
    answer:
      "Yes. Choose Share in the toolbar to publish a read-only link. Your edits keep it up to date, only your browser can change it, and people who open it can save their own copy to edit.",
  },
  {
    question: "How do I convert Markdown to PDF?",
    answer:
      "Write or import your Markdown, then choose Export → PDF in the toolbar. You get a downloadable PDF with selectable text, embedded fonts and page numbers. Printing from the browser is available too.",
  },
  {
    question: "Does it support maths and diagrams?",
    answer:
      "Yes. Write LaTeX between $…$ or $$…$$ for KaTeX maths, and use a mermaid code block for flowcharts, sequence diagrams and other Mermaid diagrams.",
  },
  {
    question: "Can I import my existing Markdown files?",
    answer:
      "Yes. Import .md files, or a .zip archive that becomes a folder, from the sidebar. You can download any document as a .md file or export everything as a .zip.",
  },
  {
    question: "Is Andiko open source?",
    answer:
      "Yes. The code is on GitHub under the MIT License, and you can self-host it on any Node.js server or on Vercel.",
  },
]

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: siteName,
      url: siteUrl,
    },
    {
      "@type": "WebApplication",
      name: siteName,
      url: siteUrl,
      description: siteDescription,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires a modern browser with JavaScript and IndexedDB.",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
      license: "https://opensource.org/licenses/MIT",
      sameAs: repoUrl,
      featureList: features.map((feature) => feature.title),
    },
  ],
}

function GitHubIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3" />
    </svg>
  )
}

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <header className={cn(container, "flex h-14 items-center justify-between gap-4")}>
        <span className="flex items-center gap-2 font-semibold tracking-tight">
          <LogoMark />
          {siteName}
        </span>
        <nav className="flex items-center gap-2">
          <ThemeSwitcher className="hidden sm:flex" />
          <Button variant="ghost" size="icon" asChild>
            <a href={repoUrl} aria-label="Andiko on GitHub">
              <GitHubIcon />
            </a>
          </Button>
          <Button asChild>
            <Link href="/d">Open editor</Link>
          </Button>
        </nav>
      </header>

      <main className="flex-1">
        <section className={cn(container, "pt-14 pb-16 text-center sm:pt-20")}>
          <p className="text-sm font-medium text-muted-foreground">Free · Open source · No sign-up</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            The Markdown editor with live preview and PDF export
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-muted-foreground">
            Write Markdown on one side and read it on the other, with KaTeX maths, Mermaid diagrams and alert boxes.
            Export a print-ready PDF in one click. Your documents stay in your browser unless you share them.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild className="px-4">
              <Link href="/d">
                Start writing
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="px-4">
              <a href={repoUrl}>
                <GitHubIcon data-icon="inline-start" />
                View on GitHub
              </a>
            </Button>
          </div>

          <div className="mt-14 overflow-hidden rounded-xl border bg-muted shadow-lg">
            {/* the html.dark class picks the matching screenshot; lazy loading skips the hidden one */}
            <Image
              src="/screenshot-light.png"
              alt={screenshotAlt}
              width={2160}
              height={1350}
              sizes="(min-width: 1024px) 1024px, 100vw"
              fetchPriority="high"
              className="dark:hidden"
            />
            <Image
              src="/screenshot-dark.png"
              alt={screenshotAlt}
              width={2160}
              height={1350}
              sizes="(min-width: 1024px) 1024px, 100vw"
              fetchPriority="high"
              className="hidden dark:block"
            />
          </div>
        </section>

        <section id="features" className="border-t bg-muted/40">
          <div className={cn(container, "py-16 sm:py-20")}>
            <h2 className="text-center text-3xl font-semibold tracking-tight text-balance">
              Everything you need to write in Markdown
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-pretty text-muted-foreground">
              From quick notes to technical documents with equations and diagrams.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-xl border bg-card p-5 text-card-foreground">
                  <div className="flex size-9 items-center justify-center rounded-lg border bg-muted text-foreground">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 font-medium">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="border-t">
          <div className={cn(container, "py-16 sm:py-20")}>
            <h2 className="text-center text-3xl font-semibold tracking-tight">Frequently asked questions</h2>
            <div className="mt-10 divide-y rounded-xl border">
              {faqs.map(({ question, answer }) => (
                <details key={question} className="group px-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
                    <h3 className="font-medium">{question}</h3>
                    <span
                      aria-hidden="true"
                      className="text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="max-w-3xl pb-4 text-muted-foreground">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/40">
          <div className={cn(container, "py-16 text-center")}>
            <h2 className="text-3xl font-semibold tracking-tight">Start writing in seconds</h2>
            <p className="mt-3 text-muted-foreground">No sign-up and nothing to install.</p>
            <Button size="lg" asChild className="mt-6 px-4">
              <Link href="/d">
                Open the editor
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className={cn(container, "flex flex-wrap items-center justify-between gap-4 py-6 text-sm text-muted-foreground")}>
          <span className="flex items-center gap-2">
            <LogoMark className="size-5" />
            {siteName} is open source under the MIT License.
          </span>
          <span className="flex items-center gap-4">
            {privacyPolicy && (
              <>
                <Link href="/privacy" className="hover:text-foreground">
                  Privacy
                </Link>
                <Link href="/terms" className="hover:text-foreground">
                  Terms
                </Link>
              </>
            )}
            <a href={repoUrl} className="hover:text-foreground">
              Source on GitHub
            </a>
          </span>
        </div>
      </footer>
    </div>
  )
}
