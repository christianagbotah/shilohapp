"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Save, Settings2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUi } from "@/store/ui";
import { fetchJson } from "@/hooks/use-store-data";
import { useToast } from "@/hooks/use-toast";

type SettingsResponse = {
  momoNumber: string;
  momoName: string;
  announcement: string;
};

export function AdminSettings({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [momoNumber, setMomoNumber] = useState("");
  const [momoName, setMomoName] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchJson<SettingsResponse>("/api/admin/settings", {
      headers: { "x-admin-token": token },
    })
      .then((res) => {
        if (cancelled) return;
        setMomoNumber(res.momoNumber);
        setMomoName(res.momoName);
        setAnnouncement(res.announcement);
      })
      .catch((err) => {
        toast({
          title: "Could not load settings",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const saveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetchJson("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({
          momoNumber: momoNumber.trim(),
          momoName: momoName.trim(),
          announcement: announcement.trim(),
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["store-info"] });
      toast({ title: "Store settings saved" });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Use at least 6 characters.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      await fetchJson("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ newPassword }),
      });
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Password changed",
        description: "You'll need to log in again on other devices.",
      });
    } catch (err) {
      toast({
        title: "Could not change password",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading settings…
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={saveStore} className="gold-panel rounded-3xl p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
            <Wallet className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold">Payment & Storefront</h2>
            <p className="text-xs text-muted-foreground">
              Shown to customers on the store and payment instructions
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="momo-number" className="text-sm font-semibold">
              MTN MoMo number (receives all payments)
            </Label>
            <Input
              id="momo-number"
              value={momoNumber}
              onChange={(e) => setMomoNumber(e.target.value)}
              placeholder="055 123 4567"
              className="h-12 rounded-xl border-border bg-background/60 font-mono text-base"
              maxLength={25}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="momo-name" className="text-sm font-semibold">
              MoMo account name
            </Label>
            <Input
              id="momo-name"
              value={momoName}
              onChange={(e) => setMomoName(e.target.value)}
              placeholder="Shiloh Merch GH"
              className="h-12 rounded-xl border-border bg-background/60"
              maxLength={60}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="announcement" className="text-sm font-semibold">
              Announcement bar text
            </Label>
            <Input
              id="announcement"
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder="Order early — delivery before Dec 8"
              className="h-12 rounded-xl border-border bg-background/60"
              maxLength={160}
            />
            <p className="text-xs text-muted-foreground">Leave empty to hide the top bar.</p>
          </div>
        </div>

        <Button
          type="submit"
          disabled={saving}
          className="mt-5 h-12 w-full rounded-full bg-gradient-to-r from-gold to-gold-deep font-bold text-primary-foreground hover:opacity-95"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" aria-hidden />
          ) : (
            <Save className="mr-2 h-4.5 w-4.5" aria-hidden />
          )}
          {saving ? "Saving…" : "Save store settings"}
        </Button>
      </form>

      <form onSubmit={savePassword} className="rounded-3xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
            <KeyRound className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold">Back office password</h2>
            <p className="text-xs text-muted-foreground">
              Changing it signs out every other device
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="new-password" className="text-sm font-semibold">
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="h-12 rounded-xl border-border bg-background/60"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm-password" className="text-sm font-semibold">
              Confirm new password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat the new password"
              className="h-12 rounded-xl border-border bg-background/60"
            />
          </div>
        </div>

        <Button
          type="submit"
          disabled={savingPassword || !newPassword}
          variant="outline"
          className="mt-5 h-12 w-full rounded-full border-border font-semibold hover:border-gold/40 hover:text-gold"
        >
          {savingPassword ? (
            <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" aria-hidden />
          ) : (
            <Settings2 className="mr-2 h-4.5 w-4.5" aria-hidden />
          )}
          {savingPassword ? "Changing…" : "Change password"}
        </Button>
      </form>
    </div>
  );
}
