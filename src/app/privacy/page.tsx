import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { LogoMark } from "@/components/logo"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { Button } from "@/components/ui/button"
import { privacyPolicy, repoUrl, siteName } from "@/lib/site"

// Written to the GDPR's transparency requirements, which also covers most other privacy laws.
// Keep it in step with what the code stores: src/lib/db.ts, src/lib/share/, the cookies in
// src/lib/db.ts and src/components/ui/sidebar.tsx, the localStorage keys prefixed "andiko:",
// and the remote images that src/lib/security/shared-page-policy.ts allows.
// The operator details come from NEXT_PUBLIC_* settings (src/lib/site.ts); the hosting
// providers named below are the ones this project is built for (Vercel and Neon), and the
// 30-day limits are the longest log retention and restore history those providers offer.

const UPDATED = "9 October 2026"

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `What ${siteName} stores, where, and for how long. Documents stay in your browser unless you share them.`,
  alternates: { canonical: "/privacy" },
}

export default function PrivacyPage() {
  // a policy that can't say who is responsible or where data lives isn't published at all
  if (!privacyPolicy) notFound()
  const { operatorName, contactEmail, databaseRegion } = privacyPolicy
  const mail = <a href={`mailto:${contactEmail}`}>{contactEmail}</a>

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <LogoMark />
          {siteName}
        </Link>
        <nav className="flex items-center gap-2">
          <ThemeSwitcher className="hidden bg-muted sm:flex" />
          <Button asChild>
            <Link href="/d">Open editor</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-8 pb-16 sm:px-6">
        <article className="markdown-body">
          <h1>Privacy policy</h1>
          <p>
            <em>Last updated {UPDATED}</em>
          </p>

          <h2>In short</h2>
          <ul>
            <li>Your documents are stored in your browser, not on our servers.</li>
            <li>
              A document reaches our server only when you <strong>share</strong> it (it is stored until you stop
              sharing) or <strong>export it as a PDF</strong> (it is processed and discarded).
            </li>
            <li>Images that a document includes from other websites are loaded from those websites.</li>
            <li>There are no accounts, ads, analytics or tracking cookies, and we don’t sell data.</li>
          </ul>

          <h2>Who we are</h2>
          <p>
            {siteName} is run by {operatorName}, who is responsible for the personal data described here (the “data
            controller”). For anything about privacy, or to report a shared document, email {mail}.
          </p>

          <h2>What stays in your browser</h2>
          <p>
            These never leave your device unless you share or export a document. Clearing your browser’s data for this
            site deletes them, and we cannot recover them.
          </p>
          <ul>
            <li>
              <strong>Documents and folders</strong>, in your browser’s IndexedDB storage.
            </li>
            <li>
              <strong>Preferences</strong> in localStorage: theme, view mode, split position, scroll sync, open folders
              and the last document you opened. If a page closes before your latest edits are saved, they are also kept
              there until you next open that document.
            </li>
            <li>
              <strong>An owner key</strong> in localStorage: a random code created the first time you open the editor.
              It proves to our server that documents you shared came from this browser.
            </li>
            <li>
              <strong>Two cookies</strong>: <code>andiko_resume</code> (kept for a year) takes you straight back to the
              editor from the home page, and <code>sidebar_state</code> (kept for a week) remembers whether the sidebar
              is open. Neither contains anything that identifies you.
            </li>
          </ul>
          <p>
            All of these are needed for the app to work as you’d expect, so we don’t ask for consent to store them.
          </p>

          <h2>What reaches our server</h2>
          <p>
            Sharing and PDF export are optional. Everything else works without sending your documents to our server.
          </p>
          <h3>Shared documents</h3>
          <p>When you share a document, we store:</p>
          <ul>
            <li>its title and full text, updated each time you edit it;</li>
            <li>
              a one-way fingerprint (SHA-256 hash) of your owner key, so only your browser can change or remove it.
              The key itself is never stored. The fingerprint is the same for every document you share from one
              browser, so it shows which documents came from the same browser, but not who you are;
            </li>
            <li>when it was shared and last updated.</li>
          </ul>
          <p>
            Anyone with the link can read a shared document, and anyone who opens it can save their own copy in their
            browser. Copies are outside our control. Shared documents ask search engines not to list them, but links
            can be passed on, the link itself contains the document’s title, and apps that preview links (such as chat
            apps) show it too. Don’t share anything you want to keep private.
          </p>
          <p>
            We keep a shared document until you stop sharing it or delete it. It is then removed from our database
            straight away, and from our database provider’s restore history within 30 days. If you lose your owner key
            (for example by clearing your browser data), you can no longer remove it yourself: email {mail} with the
            link and we will remove it.
          </p>

          <h3>PDF export</h3>
          <p>
            To create a PDF, your browser sends the rendered document to our server. It is turned into a PDF and sent
            back straight away, and it is not stored. If the document includes images from other websites, our server
            downloads them to put them in the PDF.
          </p>

          <h3>Technical logs</h3>
          <p>
            Like any website, our hosting provider records technical details of each request, such as your IP address,
            browser type and the page requested. These logs are used to keep the service running and secure, and are
            deleted after 30 days at most.
          </p>

          <h2>Images and links to other websites</h2>
          <p>
            Documents can include images from other websites. Your browser loads these directly from those websites, as
            on any web page, so they see your IP address and browser type. This includes shared documents: whoever
            shares one can include an image from a server they control and see when it is opened, and from which IP
            address. Links in a document lead to other websites, which have their own privacy policies.
          </p>

          <h2>When you email us</h2>
          <p>
            If you email us, for example to report a shared document or about your data, we receive your email address
            and what you write. We use them only to deal with your message, and delete them a year after it is
            resolved, which leaves time for any follow-up.
          </p>

          <h2>Why we use this data</h2>
          <ul>
            <li>
              <strong>To provide what you ask for</strong>: publishing and updating shared documents, and creating
              PDFs (performance of a contract, GDPR Art. 6(1)(b)).
            </li>
            <li>
              <strong>To keep the service secure</strong>: technical logs and the limits on shared documents
              (legitimate interests, GDPR Art. 6(1)(f)).
            </li>
            <li>
              <strong>To handle reports and answer emails</strong>: acting on reports of illegal content (legal
              obligation, GDPR Art. 6(1)(c)) and answering other messages (legitimate interests, GDPR Art. 6(1)(f)).
            </li>
          </ul>
          <p>We don’t use your data for profiling, advertising or automated decisions.</p>

          <h2>Who processes it for us</h2>
          <ul>
            <li>
              <strong>Vercel</strong> hosts the website and creates PDFs. It serves pages from a global network and is
              based in the United States.
            </li>
            <li>
              <strong>Neon</strong>, also based in the United States, stores shared documents in its {databaseRegion}{" "}
              region.
            </li>
            <li>
              <strong>Our email provider</strong> receives and stores the emails you send us.
            </li>
          </ul>
          <p>
            They process data only on our instructions, under data processing agreements. Where data is transferred
            outside the European Economic Area, they rely on safeguards such as the EU–US Data Privacy Framework or the
            EU Standard Contractual Clauses.
          </p>

          <h2>Your rights</h2>
          <p>
            Depending on where you live, you can ask to access, correct or delete your personal data, to restrict or
            object to how we use it, and to receive a copy of it. The quickest way to delete a shared document is
            “Stop sharing” in the app. For anything else, email {mail}. As there are no accounts, we can only find your
            shared documents if you send us their links. You can also complain to the data protection authority in your
            country.
          </p>

          <h2>Reporting a shared document</h2>
          <p>
            If a shared document is illegal or infringes your rights, use <strong>Report</strong> on its page or email{" "}
            {mail} with the link and what is wrong with it. We review every report, reply to tell you what we decided,
            and remove documents that are illegal or infringe someone’s rights.
          </p>

          <h2>Changes</h2>
          <p>
            If we change how {siteName} handles data, we will update this page and its date. The source code, which
            shows exactly what is stored, is <a href={repoUrl}>on GitHub</a>.
          </p>
        </article>
      </main>
    </div>
  )
}
