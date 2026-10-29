import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy policy · TripSplit" };

// Reads CONTACT_EMAIL at request time rather than baking it in at build.
export const dynamic = "force-dynamic";

const UPDATED = "October 28, 2026";

export default function PrivacyPage() {
  const contact = process.env.CONTACT_EMAIL;
  return (
    <article className="card space-y-6 p-6 text-sm leading-relaxed sm:p-8 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Privacy policy</h1>
        <p className="muted mt-1">Last updated {UPDATED}</p>
      </header>

      <section className="rounded-xl bg-brand-50 p-4 dark:bg-brand-700/20">
        <h2>The short version</h2>
        <p>
          TripSplit is a small, privately run app for splitting trip costs with friends. It keeps only what it needs to
          do that. There are no ads and no tracking, and nothing is sold or shared for marketing.
        </p>
      </section>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>From your Google account, when you sign in:</strong> your name, email address, and profile picture.
            We also store the sign-in tokens Google issues, along with your account. We don&apos;t get your password or
            access to anything else in your Google account.
          </li>
          <li>
            <strong>What you and your group enter:</strong> trips, the people on them (names and, if provided, email
            addresses), expenses, how they&apos;re split, notes, and payments between people.
          </li>
          <li>
            <strong>A history of changes:</strong> who added, edited, or deleted what, and when. This lets the group
            see changes and undo mistakes.
          </li>
          <li>
            <strong>Basic technical data:</strong> a sign-in cookie, and server logs that may include errors and
            technical details of requests.
          </li>
        </ul>
      </section>

      <section>
        <h2>How it&apos;s used</h2>
        <p>
          Only to run TripSplit. That means signing you in, showing your trips, working out who owes whom, sending trip
          invitations, and keeping the change history.
        </p>
      </section>

      <section>
        <h2>Who can see it</h2>
        <ul>
          <li>
            <strong>People on the same trip</strong> can see that trip&apos;s expenses, payments, and history. They can
            also see the name, email address, and profile picture of each member.
          </li>
          <li>
            <strong>Anyone with a trip&apos;s invite link</strong> can join that trip after signing in, and then sees
            the same things. Share invite links only with people you mean to invite. The organizer can reset the link
            at any time.
          </li>
          <li>
            <strong>The person who runs this site</strong> has access to the database in order to operate and maintain
            it.
          </li>
        </ul>
      </section>

      <section>
        <h2>Services involved</h2>
        <ul>
          <li>
            <strong>Google</strong>: handles sign-in. Your browser also loads your profile picture directly from Google.
          </li>
          <li>
            <strong>Cloudflare</strong>: carries traffic between your browser and the server, so it handles your IP
            address and requests.
          </li>
          <li>
            <strong>Email delivery</strong>: invitation emails go through an email provider, which receives the
            recipient&apos;s address and the message.
          </li>
          <li>
            <strong>Frankfurter</strong> (exchange rates): when an expense is in a foreign currency, the server looks
            up a rate. Only the currencies and date are sent, never any personal information.
          </li>
        </ul>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          TripSplit uses cookies only to keep you signed in and to secure the sign-in process. There are no analytics
          or advertising cookies.
        </p>
      </section>

      <section>
        <h2>Keeping and deleting your data</h2>
        <ul>
          <li>Data is kept for as long as the trip exists.</li>
          <li>
            A trip&apos;s organizer can delete the trip from its Settings tab. This permanently removes the trip, its
            expenses, payments, and history, for everyone.
          </li>
          <li>
            To have your account removed, or to ask what we hold about you, use the contact details below. Expenses
            you were part of stay with the trip so the group&apos;s balances stay correct, unless the organizer deletes
            the trip.
          </li>
        </ul>
      </section>

      <section>
        <h2>Google user data</h2>
        <p>
          TripSplit&apos;s use of information received from Google APIs adheres to the{" "}
          <a
            className="text-brand-600 underline"
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>If this policy changes, the date at the top will be updated.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          {contact ? (
            <>
              Questions or requests:{" "}
              <a className="text-brand-600 underline" href={`mailto:${contact}`}>
                {contact}
              </a>
            </>
          ) : (
            "Questions or requests: contact the person who runs this site, or the trip organizer who invited you."
          )}
        </p>
      </section>

      <p>
        <Link href="/" className="text-brand-600 hover:underline">← Back to TripSplit</Link>
      </p>
    </article>
  );
}
