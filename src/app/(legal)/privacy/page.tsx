// DRAFT: template privacy policy. Written as a good-faith starting point to
// cover GDPR basics (what's collected, why, legal basis, deletion/export,
// contact), not reviewed by a lawyer. Have counsel review before a real launch.
import type { ReactNode } from "react";

export const metadata = { title: "Privacy Policy" };

// Exported so sitemap.ts can report an accurate <lastmod> without duplicating the date.
export const LAST_UPDATED = "2026-09-16";

export default function PrivacyPage() {
  return (
    <article className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Privacy Policy</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>
      </div>

      <Section title="1. What we collect">
        <p>When you create an account, we store:</p>
        <ul className="list-disc pl-5">
          <li>Your name and email address (email is never shown to other users).</li>
          <li>Your password, hashed &mdash; we never store or see it in plain text.</li>
          <li>Your timezone (used only to group your sessions into days).</li>
          <li>
            Behavioral data you create by using the app: immersion sessions (what, when, for how long), library
            entries and progress, goals, session notes, follows, kudos, and club memberships/picks/votes.
          </li>
          <li>Basic technical data needed to keep you signed in and rate-limit abuse (session tokens, IP address).</li>
        </ul>
      </Section>

      <Section title="2. Why we collect it">
        <p>
          To provide the service itself: tracking your immersion time, showing your library and stats, and powering
          the optional social features (leaderboards, feed, clubs) if you keep your profile public. We don&rsquo;t
          use your data for advertising profiling, and we don&rsquo;t sell it.
        </p>
      </Section>

      <Section title="3. Legal basis (EU/UK users)">
        <p>
          We process your account data to perform our contract with you (running the service you signed up for). If
          we ever send non-essential email, we&rsquo;ll ask for consent first. You can withdraw consent or object to
          processing at any time by adjusting your settings or deleting your account.
        </p>
      </Section>

      <Section title="4. Who sees your data">
        <p>
          If your profile is public (the default; you can turn this off in Settings), your name, image, activity
          feed entries, and stats are visible to other signed-in users. Session notes and club names/descriptions are
          free text you write and are visible to whoever can see that session or club. We don&rsquo;t share your data
          with third parties except the infrastructure needed to run the service (hosting, database, and
          transactional email delivery for password resets/verification).
        </p>
      </Section>

      <Section title="5. Third-party media metadata">
        <p>
          Cover art, titles, and descriptions for media come from AniList, VNDB, TMDB, and Google Books. Searching
          those sources may send your query to them; see their own privacy policies for how they handle that.
        </p>
      </Section>

      <Section title="6. How long we keep it">
        <p>
          We keep your data for as long as your account exists. If you stop using the service without deleting your
          account, your data stays until you delete it or ask us to.
        </p>
      </Section>

      <Section title="7. Your rights">
        <p>You can, at any time, from Settings:</p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Export</strong> a copy of your data as a JSON file (Settings &rarr; Your data).
          </li>
          <li>
            <strong>Delete</strong> your account and all associated data (Settings &rarr; Danger zone). This is
            permanent and cannot be undone.
          </li>
          <li>Correct inaccurate profile data yourself (name, timezone) from Settings.</li>
        </ul>
        <p>
          If you&rsquo;re in the EU/UK and believe we&rsquo;ve mishandled your data, you also have the right to lodge
          a complaint with your local data protection authority.
        </p>
      </Section>

      <Section title="8. Security">
        <p>
          Passwords are hashed, not stored in plain text. We use standard measures (HTTPS, secure session cookies,
          rate limiting) to protect your data, but no system is perfectly secure.
        </p>
      </Section>

      <Section title="9. Contact">
        <p>
          Questions, or a data request you&rsquo;d rather we handle manually:{" "}
          <a href="mailto:privacy@immersemoar.app">privacy@immersemoar.app</a>.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="grid gap-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
