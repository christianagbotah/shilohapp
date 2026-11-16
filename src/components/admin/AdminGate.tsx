"use client";

import { useState } from "react";
import { ArrowLeft, Crown, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUi } from "@/store/ui";
import { fetchJson } from "@/hooks/use-store-data";

export function AdminGate() {
  const setAdminToken = useUi((s) => s.setAdminToken);
  const setView = useUi((s) => s.setView);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Enter the back office password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<{ token: string }>("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setAdminToken(res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hero-radial relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden />
      <form
        onSubmit={login}
        className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-7 shadow-2xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-gold-deep text-primary-foreground shadow-[0_10px_28px_-8px_var(--gold)]">
            <Crown className="h-7 w-7" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold">Back Office</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shiloh 2026 Merch — orders &amp; payments
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="admin-password" className="text-sm font-semibold">
            Password
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-xl border-border bg-background/60 pl-10"
              placeholder="••••••••"
              autoFocus
            />
          </div>
        </div>

        {error ? (
          <p className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={loading}
          className="mt-5 h-12 w-full rounded-full bg-gradient-to-r from-gold to-gold-deep font-bold text-primary-foreground hover:opacity-95"
        >
          {loading ? <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" aria-hidden /> : null}
          {loading ? "Checking…" : "Enter Back Office"}
        </Button>

        <Button
          type="button"
          variant="ghost"
          className="mt-2 h-11 w-full rounded-full text-muted-foreground"
          onClick={() => setView("store")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Back to store
        </Button>
      </form>
    </div>
  );
}
