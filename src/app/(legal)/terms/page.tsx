// DRAFT: template terms of service. Written as a good-faith starting point,
// not reviewed by a lawyer. Have counsel review before relying on this for a
// real launch, especially around EU/UK consumer protection and liability caps.
import type { ReactNode } from "react";

export const metadata = { title: "Terms of Service" };

const LAST_UPDATED = "2026-09-16";

export default function TermsPage() {
  return (
    <article className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Terms of Service</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>
      </div>

      <Section title="1. What this is">
        <p>
          immersemoar (&ldquo;the service&rdquo;, &ldquo;we&rdquo;) is a personal tool for tracking time spent
          consuming Japanese-language media, plus optional social features (following other users, clubs, kudos,
          leaderboards). By creating an account you agree to these terms.
        </p>
      </Section>

      <Section title="2. Your account">
        <p>
          You&rsquo;re responsible for the accuracy of the information you provide and for keeping your password
          secure. You must be old enough in your jurisdiction to agree to these terms on your own behalf. One person,
          one account &mdash; don&rsquo;t share credentials or impersonate someone else.
        </p>
      </Section>

      <Section title="3. Content you post">
        <p>
          Display names, session notes, and club names/descriptions are visible to other users (or the public, for
          public profiles and public clubs). Don&rsquo;t post anything illegal, harassing, hateful, or that infringes
          someone else&rsquo;s rights. We may hide or remove content, and suspend or ban accounts, that violate this.
          You keep ownership of what you post; by posting it where it&rsquo;s visible to others you allow us to store
          and display it as part of running the service.
        </p>
      </Section>

      <Section title="4. Media metadata">
        <p>
          Titles, cover art, descriptions and similar metadata shown for anime, manga, visual novels, movies, series
          and books come from third-party sources (AniList, VNDB, TMDB, Google Books) and belongs to its respective
          rights holders. We display it for identification purposes only.
        </p>
      </Section>

      <Section title="5. Availability and changes">
        <p>
          This is a small, evolving project. Features may change or be removed, and we don&rsquo;t guarantee
          uninterrupted availability. We&rsquo;ll try to give notice before anything that meaningfully affects your
          data.
        </p>
      </Section>

      <Section title="6. Termination">
        <p>
          You can delete your account at any time from Settings &rarr; Danger zone, which permanently deletes your
          data as described in the <a href="/privacy">Privacy Policy</a>. We may suspend or terminate accounts that
          violate these terms.
        </p>
      </Section>

      <Section title="7. Disclaimer and liability">
        <p>
          The service is provided &ldquo;as is&rdquo;, without warranties of any kind. To the maximum extent
          permitted by law, we&rsquo;re not liable for indirect, incidental, or consequential damages arising from
          your use of the service. Nothing here limits liability that can&rsquo;t be limited under applicable law
          (for example, statutory consumer rights in the EU/UK).
        </p>
      </Section>

      <Section title="8. Contact">
        <p>
          Questions about these terms: <a href="mailto:hello@immersemoar.app">hello@immersemoar.app</a>.
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
