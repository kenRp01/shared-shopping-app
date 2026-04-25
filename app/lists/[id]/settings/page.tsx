"use client";

import { useParams } from "next/navigation";
import { ListSettingsClient } from "@/components/list-settings-client";

export default function ListSettingsPage() {
  const params = useParams<{ id: string }>();
  return <ListSettingsClient listId={params.id} />;
}
