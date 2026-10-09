import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { LegalPage, OperatorDetails } from "@/components/legal-page"
import { MAX_SHARE_BYTES } from "@/lib/share/protocol"
import { MAX_SHARES_PER_OWNER } from "@/lib/share/store"
import { privacyPolicy, repoUrl, siteName, siteUrl } from "@/lib/site"

// Adapted from the Codeberg Terms of Use and the Basecamp Use Restrictions (see the last
// section), with what the EU Digital Services Act asks of every hosting service added:
// content rules and moderation (Art. 14), the notice contents (Art. 16), reporting threats
// to life or safety (Art. 18) and a single point of contact (Art. 11-12).
// The page's text is CC BY-SA 4.0, as its sources require; the code stays MIT.
// Keep it in step with what the app does: the share limits come from src/lib/share/, and
// the Report link in src/components/shared/shared-document.tsx asks for the notice contents.

const UPDATED = "9 October 2026"

/** Languages we answer in (DSA Art. 11-12). An operator outside English-speaking countries adds their own. */
const CONTACT_LANGUAGES = "English"

export const metadata: Metadata = {
  title: "Terms of use",
  description: `The rules for using ${siteName} and sharing documents with it, and how reports are handled.`,
  alternates: { canonical: "/terms" },
}

export default function TermsPage() {
  // published together with the privacy policy, since both have to name who runs this instance
  if (!privacyPolicy) notFound()
  const { operatorName, operatorAddress, operatorRegistration, contactEmail } = privacyPolicy
  const mail = <a href={`mailto:${contactEmail}`}>{contactEmail}</a>

  return (
    <LegalPage title="Terms of use" updated={UPDATED}>
      <h2>In short</h2>
      <ul>
        <li>
          {siteName} is a free Markdown editor. Your documents stay in your browser, and keeping them is up to you.
        </li>
        <li>What you share stays yours, and you are responsible for it. Don’t share anything illegal or harmful.</li>
        <li>
          Anyone can report a shared document. A person reviews every report, and we remove what breaks the rules.
        </li>
        <li>The service is free and provided as it is. It may change or stop.</li>
      </ul>

      <h2>About these terms</h2>
      <p>
        {siteName} at <a href={siteUrl}>{siteUrl}</a> is run by {operatorName} (“we”). These terms are an agreement
        between you and {operatorName}: by using {siteName}, and in particular by sharing a document, you agree to
        them. How we handle personal data is described in the <Link href="/privacy">privacy policy</Link>.
      </p>
      <OperatorDetails name={operatorName} address={operatorAddress} registration={operatorRegistration} />

      <h2>What we provide</h2>
      <p>
        {siteName} is a Markdown editor that runs in your browser. It is free and needs no account. You can write and
        organise documents, export them as Markdown, PDF or a .zip file, and share a document through a public link.
      </p>
      <p>
        The source code is <a href={repoUrl}>open source</a> under the MIT License. These terms cover this website, not
        what you do with the code.
      </p>

      <h2>Your documents</h2>
      <p>
        Your documents are stored only in your browser. We cannot see, back up or recover them: clearing your browser’s
        data, losing your device or switching browsers can lose them for good. You are responsible for exporting
        anything you want to keep.
      </p>

      <h2>Sharing a document</h2>
      <p>
        When you share a document, anyone with its link can read it and save a copy in their own browser. Your edits
        update the shared copy until you stop sharing it. A shared document can be up to{" "}
        {MAX_SHARE_BYTES / 1024 / 1024} MB, and one browser can share up to {MAX_SHARES_PER_OWNER} documents.
      </p>
      <p>
        You are responsible for what you share. Only share content you have the right to share, and remember that
        anyone who gets the link can read it.
      </p>
      <p>
        You keep all rights to what you share; sharing transfers no ownership to us. You allow us to store, copy and
        display a shared document, and to turn it into other formats such as PDF, as far as needed to run the service,
        for as long as it is shared and until it is gone from our backups. You also allow anyone who opens its link to
        read it and save a copy for their own use.
      </p>

      <h2>What is not allowed</h2>
      <p>You must not use {siteName} to share, link to or do any of the following:</p>
      <ul>
        <li>
          anything illegal, such as child sexual abuse material, terrorist content, or content that infringes someone’s
          copyright or other rights;
        </li>
        <li>
          content that expresses hate or encourages violence towards a person or group, including discrimination on
          grounds such as ethnicity, gender, disability, nationality, age or religion, and Nazi propaganda;
        </li>
        <li>
          harassment, threats, stalking or doxxing (publishing someone’s personal information), or encouraging others
          to do these;
        </li>
        <li>sexually explicit content;</li>
        <li>fraud, scams, phishing, or pretending to be someone else;</li>
        <li>viruses or other malware;</li>
        <li>
          images, links or other means of tracking readers or collecting information about them without their
          knowledge;
        </li>
        <li>spam, or documents made only to advertise something or to manipulate search results;</li>
        <li>
          interfering with or overloading the service, for example by sharing or exporting documents automatically in
          bulk, or getting around its limits or security;
        </li>
        <li>false or abusive reports.</li>
      </ul>
      <p>These examples show the spirit of the rules rather than every case they cover.</p>

      <h2>Reporting a shared document</h2>
      <p>
        If you think a shared document is illegal or breaks these terms, use <strong>Report</strong> on its page or
        email {mail}. Please include:
      </p>
      <ul>
        <li>the link to the document;</li>
        <li>what is wrong with it and, if you think it is illegal, why;</li>
        <li>your name and email address (you may leave these out when reporting child sexual abuse material);</li>
        <li>a statement that you believe in good faith that your report is accurate and complete.</li>
      </ul>
      <p>
        We will confirm that we received your report, and tell you what we decided and why. We do not tell the person
        who shared the document who reported it, unless the law requires us to.
      </p>

      <h2>How we moderate</h2>
      <p>
        We don’t monitor shared documents and don’t use automated tools to moderate them. A person reviews every report,
        and we may also look at a shared document when we need to keep the service safe.
      </p>
      <p>
        When a shared document is illegal or breaks these terms, we remove it and its link stops working. There are no
        accounts, so we have no way to tell the person who shared it. If someone keeps sharing such documents, we may
        also remove the other documents shared from the same browser. If a document suggests a crime that threatens
        someone’s life or safety, we will inform the authorities, as the law requires.
      </p>

      <h2>If you disagree with a decision</h2>
      <p>
        If we removed a document you shared, or did not act on your report, and you think we got it wrong, email{" "}
        {mail} with the link and your reasons. We will review the decision and tell you the outcome. You can also take the
        matter to court.
      </p>

      <h2>Contact</h2>
      <p>
        For anything about these terms, including reports and messages from authorities, email {mail}. This is our
        single point of contact under the EU Digital Services Act, for users and authorities alike. You can write to us
        in {CONTACT_LANGUAGES}.
      </p>

      <h2>Availability and changes to the service</h2>
      <p>
        {siteName} is free, and we don’t guarantee that it will be available, keep working the same way, or keep shared
        documents online. We may change its features and limits, remove shared documents as these terms describe, or
        stop running it. If we stop, we will say so on the site beforehand where we can.
      </p>

      <h2>Liability</h2>
      <p>
        {siteName} is provided free of charge and “as is”, without any warranty, for example that it is free of errors,
        fit for a particular purpose, or that documents, links and PDFs will be accurate, available or kept. We are not
        responsible for other websites that documents link to or load images from.
      </p>
      <p>
        As far as the law allows, we are not liable for any loss or damage from using or being unable to use {siteName},
        including lost data. Nothing in these terms limits liability that the law does not allow to be limited, such as
        for damage caused intentionally or through gross negligence, or for injury to life, body or health. Nor do they
        affect your rights as a consumer under the law of the country you live in.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms. We will change the date at the top, and announce significant changes on the site
        before they take effect. If you keep using {siteName} after that, the new terms apply. If you don’t agree with
        them, stop using {siteName} and stop sharing your documents.
      </p>

      <h2>Sources and licence of this text</h2>
      <p>
        These terms are adapted from the{" "}
        <a href="https://codeberg.org/Codeberg/org/src/branch/main/TermsOfUse.md">Codeberg Terms of Use</a> (
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>), whose rules were inspired by
        the <a href="https://chaos.social/about/more#rules">chaos.social terms</a> (
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>) and the{" "}
        <a href="https://confluence.jetbrains.com/display/ALL/JetBrains+Open+Source+and+Community+Code+of+Conduct">
          JetBrains Open Source and Community Code of Conduct
        </a>{" "}
        (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>), and from the use restrictions in
        the <a href="https://github.com/basecamp/policies">Basecamp open-source policies</a> (
        <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>). We have changed and added to them. This
        text is licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.
      </p>
    </LegalPage>
  )
}
