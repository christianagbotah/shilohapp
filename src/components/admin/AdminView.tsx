"use client";

import { useUi } from "@/store/ui";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export function AdminView() {
  const token = useUi((s) => s.adminToken);
  return token ? <AdminDashboard /> : <AdminGate />;
}
