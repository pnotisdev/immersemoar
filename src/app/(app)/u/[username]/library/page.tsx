import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ENTRY_STATUSES, MEDIA_TYPES, type EntryStatus, type MediaType } from "@/db/schema";
import { getPublicUser } from "@/lib/ranking-queries";
import { requireUser } from "@/lib/session";
import { USERNAME_RE } from "@/lib/username";
import { PageHeader } from "@/components/layout/page-header";
import { LibraryBrowser } from "@/components/library/library-browser";

export async function generateMetadata(props: PageProps<"/u/[username]/library">) {
  const { username } = await props.params;
  const u = USERNAME_RE.test(username) ? await getPublicUser(username) : null;
  return { title: u ? `${u.name}'s library` : "Library" };
}

export default async function UserLibraryPage(props: PageProps<"/u/[username]/library">) {
  const viewer = await requireUser();
  const { username } = await props.params;
  if (!USERNAME_RE.test(username)) notFound();
  const u = await getPublicUser(username);
  if (!u) notFound();

  const sp = await props.searchParams;
  const statusParam = str(sp.status);
  const typeParam = str(sp.type);
  const status = (ENTRY_STATUSES as readonly string[]).includes(statusParam ?? "") ? (statusParam as EntryStatus) : undefined;
  const type = (MEDIA_TYPES as readonly string[]).includes(typeParam ?? "") ? (typeParam as MediaType) : undefined;

  const isSelf = u.id === viewer.id;
  const firstName = u.name.split(" ")[0];

  return (
    <div>
      <Link
        href={`/u/${u.username}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {u.name}
      </Link>

      <PageHeader title={isSelf ? "Your library" : `${firstName}'s library`} />

      <LibraryBrowser
        userId={u.id}
        basePath={`/u/${u.username}/library`}
        status={status}
        type={type}
        emptyState={
          <div className="rounded-xl border border-dashed p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {isSelf ? "Your library is empty." : `${firstName} hasn't added anything to their library yet.`}
            </p>
          </div>
        }
      />
    </div>
  );
}

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
