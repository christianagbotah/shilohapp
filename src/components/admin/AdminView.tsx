"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useUi } from "@/store/ui";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export function AdminView() {
  const token = useUi((s) => s.adminToken);
  const setAdminToken = useUi((s) => s.setAdminToken);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => { if (active) setAdminToken(data.authenticated ? "session" : null); })
      .catch(() => { if (active) setAdminToken(null); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [setAdminToken]);
  if (checking) return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-gold" role="status" aria-live="polite">
      <ShieldCheck className="h-10 w-10" aria-hidden />
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <p className="text-sm font-medium text-muted-foreground">Checking your secure session…</p>
    </div>
  );
  return token ? <AdminDashboard /> : <AdminGate />;
}
