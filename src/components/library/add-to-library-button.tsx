"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { addExistingToLibrary } from "@/actions/library";
import { Button } from "@/components/ui/button";

/** For a media item that exists (someone else added it) but isn't in this user's library yet. */
export function AddToLibraryButton({ mediaItemId }: { mediaItemId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await addExistingToLibrary(mediaItemId);
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("Added to your library");
            router.refresh();
          }
        })
      }
    >
      {pending ? "Adding…" : "Add to my library"}
    </Button>
  );
}
