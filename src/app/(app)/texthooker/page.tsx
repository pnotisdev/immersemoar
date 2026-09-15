import { requireUser } from "@/lib/session";
import { getLibraryPicks } from "@/lib/view-models";
import { PageHeader } from "@/components/layout/page-header";
import { Texthooker } from "@/components/texthooker/texthooker";

export const metadata = { title: "Texthooker" };

export default async function TexthookerPage() {
  const user = await requireUser();
  const picks = await getLibraryPicks(user.id);
  return (
    <div>
      <PageHeader
        title="Texthooker"
        description="Connect LunaTranslator or Textractor, read your visual novel, and the characters and active time are logged for you."
      />
      <Texthooker entries={picks} />
    </div>
  );
}
