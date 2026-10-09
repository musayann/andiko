import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { LegalPage, OperatorDetails } from "@/components/legal-page"
import { privacyPolicy, repoUrl, siteName } from "@/lib/site"

// Written to the GDPR's transparency requirements, which also covers most other privacy laws.
// It cites no particular law, since which one applies depends on where the operator is
// established and whom it targets, and an article reference reads as accepting that law.
// Keep it in step with what the code stores: src/lib/db.ts, src/lib/share/, the cookies in
// src/lib/db.ts and src/components/ui/sidebar.tsx, the localStorage keys prefixed "andiko:",
// and the remote images that src/lib/security/shared-page-policy.ts allows.
// The operator details come from NEXT_PUBLIC_* settings (src/lib/site.ts); the hosting
// providers named below are the ones this project is built for (Vercel and Neon), and the
// 30-day limits are the longest log retention and restore history those providers offer.
// Neon's data processing agreement covers every plan, but Vercel's only covers Pro and
// Enterprise, so the policy claims none for Vercel and stays true on the Hobby plan.

const UPDATED = "9 October 2026"

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `What ${siteName} stores, where, and for how long. Documents are saved in your browser, and only shared ones are stored on our server.`,
  alternates: { canonical: "/privacy" },
}

export default function PrivacyPage() {
  // a policy that can't say who is responsible or where data lives isn't published at all
  if (!privacyPolicy) notFound()
  const { operatorName, operatorAddress, operatorRegistration, contactEmail, databaseRegion, serverRegion } =
    privacyPolicy
  const mail = <a href={`mailto:${contactEmail}`}>{contactEmail}</a>

  return (
    <LegalPage title="Privacy policy" updated={UPDATED}>
      <h2>In short</h2>
      <ul>
        <li>Your documents are saved in your browser.</li>
        <li>
          A document reaches our server only when you <strong>share</strong> it (it is stored until you stop
          sharing) or <strong>export it as a PDF</strong> (it is processed and discarded).
        </li>
        <li>Images that a document includes from other websites are loaded from those websites.</li>
        <li>There are no accounts, ads, analytics or tracking cookies, and we don’t sell data.</li>
      </ul>

      <h2>Who we are</h2>
      <p>
        {siteName} is run by {operatorName} (“we”), the “data controller” responsible for the personal data described
        here. For anything about privacy, or to report a shared document, email {mail}.
      </p>
      <OperatorDetails name={operatorName} address={operatorAddress} registration={operatorRegistration} />

      <h2>What stays in your browser</h2>
      <p>
        These are kept on your device. A document leaves it only when you share or export it, and the two cookies
        below are sent to our server with each request but hold only a setting. Clearing your browser’s data for
        this site deletes them, and we cannot recover them.
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
          a one-way fingerprint (SHA-256 hash) of your owner key, so only your browser can edit it or stop sharing
          it. The key itself is never stored. The fingerprint is the same for every document you share from one
          browser, so it links them together. On its own it doesn’t say who you are;
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
        We keep a shared document until you stop sharing it, delete it, or we remove it under our{" "}
        <Link href="/terms">terms of use</Link>. It is then removed from our database straight away, unless the law
        requires us to keep it, and from our database provider’s restore history within 30 days. If you lose your
        owner key (for example by clearing your browser data), you can no longer remove it yourself: email {mail} with
        the link, and we will remove it once we’re reasonably satisfied that you shared it.
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
        available to us for 30 days at most. Vercel may also keep its own records of requests, under its privacy
        policy.
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
          PDFs under our <Link href="/terms">terms of use</Link> (performance of a contract).
        </li>
        <li>
          <strong>To keep the service secure</strong>: technical logs and the limits on shared documents
          (legitimate interests).
        </li>
        <li>
          <strong>To moderate shared documents</strong>: reviewing reported documents, and others when we need to
          keep the service safe, and using the fingerprint to find the other documents of someone who keeps sharing
          illegal content (our legal obligations, or otherwise our legitimate interest in keeping the service
          lawful).
        </li>
        <li>
          <strong>To answer emails</strong>: dealing with reports, privacy requests and other messages (our legal
          obligations for privacy requests, and otherwise legitimate interests).
        </li>
      </ul>
      <p>We don’t use your data for profiling, advertising or automated decisions.</p>

      <h2>Who processes it for us</h2>
      <ul>
        <li>
          <strong>Vercel</strong> runs the server that creates PDFs and serves shared documents
          {serverRegion && <>, in its {serverRegion} region</>}. Pages reach you through Vercel’s global network, so
          your requests may pass through a server near you on the way.
        </li>
        <li>
          <strong>Neon</strong> stores shared documents in its {databaseRegion} region.
        </li>
        <li>
          <strong>Our email provider</strong> receives and stores the emails you send us.
        </li>
      </ul>
      <p>
        Vercel and Neon are based in the United States, so their staff may access data from there. Neon processes it
        only on our instructions, under a data processing agreement that includes the EU Standard Contractual
        Clauses. Vercel and our email provider handle it under their own terms and privacy policies.
      </p>
      <p>
        Apart from these providers, we give data to authorities only when the law requires it, or when a shared
        document suggests a threat to someone’s life or safety.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you can ask to access, correct or delete your personal data, to restrict or
        object to how we use it, and to receive a copy of it. The quickest way to delete a shared document is
        “Stop sharing” in the app. For anything else, email {mail}. As there are no accounts, include the link to one
        of your shared documents: from it, we can find the others shared from the same browser. You can also complain to the data protection authority where we
        are established, or where you live.
      </p>

      <h2>Reporting a shared document</h2>
      <p>
        If a shared document is illegal or infringes your rights, use <strong>Report</strong> on its page or email{" "}
        {mail} with the link and what is wrong with it. We review reports and remove documents we find to be illegal or
        to infringe someone’s rights. The{" "}
        <Link href="/terms">terms of use</Link> explain how reports are handled.
      </p>

      <h2>Changes</h2>
      <p>
        If we change how {siteName} handles data, we will update this page and its date. The source code, which
        shows exactly what is stored, is <a href={repoUrl}>on GitHub</a>.
      </p>
    </LegalPage>
  )
}
