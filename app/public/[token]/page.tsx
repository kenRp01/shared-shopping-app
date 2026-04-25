"use client";

import { useParams } from "next/navigation";
import { ListDetailClient } from "@/components/list-detail-client";

export default function PublicListPage() {
  const params = useParams<{ token: string }>();
  return <ListDetailClient publicToken={params.token} />;
}
