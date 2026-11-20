"use client";

import { QueryProvider } from "@/components/providers/QueryProvider";
import { AdminView } from "@/components/admin/AdminView";

export function BackOfficeClient() {
  return (
    <QueryProvider>
      <AdminView />
    </QueryProvider>
  );
}
