"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LIST_FORM } from "@/lib/constants";
import { continueAsGuest, createList, getCurrentUser, listAccessibleLists } from "@/lib/local-store";

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

        const lists = await listAccessibleLists(user.id);
        if (!active) {
          return;
        }

        if (lists.length > 0) {
          router.replace(`/lists/${lists[0].id}`);
          return;
        }

        const starter = await createList(user, {
          ...DEFAULT_LIST_FORM,
          name: "マイリスト",
          plannedDate: null,
          visibility: "private",
        });

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
    return <div className="page-grid redirect-shell" />;
  }

  return (
    <div className="page-grid redirect-shell">
      <p className="notice-inline">{error}</p>
    </div>
  );
}
