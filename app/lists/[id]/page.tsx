"use client";

import { useParams } from "next/navigation";
import { ListDetailClient } from "@/components/list-detail-client";

export default function ListDetailPage() {
  const params = useParams<{ id: string }>();
  return <ListDetailClient listId={params.id} />;
}
