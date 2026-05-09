"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_STARTER_LISTS } from "@/lib/constants";
import { continueAsGuest, createDefaultLists, ensureDefaultLists, getCurrentUser, getInitialListSnapshotBundle } from "@/lib/local-store";

export default function HomePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function redirectToList() {
      try {
        const user = await getCurrentUser();

        if (!active) {
          return;
        }

        if (!user) {
          const guest = await continueAsGuest();
          if (active) {
            router.replace(`/lists/${guest.listId}`);
          }
          return;
        }

        let initial = await getInitialListSnapshotBundle(user.id);
        if (!active) {
          return;
        }

        const hasStarterLists = DEFAULT_STARTER_LISTS.every((starter) =>
          initial.categories.some((list) => list.name === starter.name),
        );
        if (!hasStarterLists) {
          await ensureDefaultLists(user);
          initial = await getInitialListSnapshotBundle(user.id);
          if (!active) {
            return;
          }
        }

        if (initial.snapshot) {
          sessionStorage.setItem(
            "shareshopi:initial-list",
            JSON.stringify({
              user,
              snapshot: initial.snapshot,
              categories: initial.categories,
              cachedAt: Date.now(),
            }),
          );
          router.replace(`/lists/${initial.snapshot.list.id}`);
          return;
        }

        const [starter] = await createDefaultLists(user);

        if (active) {
          router.replace(`/lists/${starter.id}`);
        }
      } catch (nextError) {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : "開けませんでした。");
        }
      }
    }

    void redirectToList();

    return () => {
      active = false;
    };
  }, [router]);

  if (!error) {
    return (
      <div className="page-grid redirect-shell">
        <section className="panel landing-hero landing-hero-compact" aria-busy="true" />
      </div>
    );
  }

  return (
    <div className="page-grid redirect-shell">
      <p className="notice-inline">{error}</p>
    </div>
  );
}
