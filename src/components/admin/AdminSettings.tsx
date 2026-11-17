"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  BellRing,
  KeyRound,
  Loader2,
  Mail,
  MessageSquare,
  PlugZap,
  Save,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUi } from "@/store/ui";
import { fetchJson } from "@/hooks/use-store-data";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type SettingsResponse = {
  announcement: string;
  shilohYear: string;
  shilohTagline: string;
  shilohDates: string;
  shilohStart: string;
  hubtel: {
    clientId: string;
    secretSet: boolean;
    merchantNumber: string;
    merchantName: string;
    siteUrl: string;
    active: boolean;
  };
  sms: {
    clientId: string;
    secretSet: boolean;
    sender: string;
    adminPhone: string;
    adminEmail: string;
    notifyCustomer: boolean;
    notifyStatus: boolean;
    notifyAdmin: boolean;
  };
  email: {
    host: string;
    port: string;
    user: string;
    passwordSet: boolean;
    secure: boolean;
    from: string;
    to: string;
    notifyAdmin: boolean;
  };
};

function CardShell({
  icon: Icon,
  title,
  subtitle,
  children,
  gold,
  status,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  gold?: boolean;
  status?: { label: string; ok: boolean };
}) {
  return (
    <section
      className={cn(
        "rounded-3xl p-6",
        gold ? "gold-panel" : "border border-border bg-card"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            gold ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {status ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-wider",
              status.ok
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {status.label}
          </span>
        ) : null}
      </div>
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const inputCls = "h-12 rounded-xl border-border bg-background/60 text-base";

export function AdminSettings({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Branding / store
  const [announcement, setAnnouncement] = useState("");
  const [shilohYear, setShilohYear] = useState("");
  const [shilohTagline, setShilohTagline] = useState("");
  const [shilohDates, setShilohDates] = useState("");
  const [shilohStart, setShilohStart] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Hubtel payment
  const [hubtelClientId, setHubtelClientId] = useState("");
  const [hubtelSecret, setHubtelSecret] = useState("");
  const [hubtelSecretSet, setHubtelSecretSet] = useState(false);
  const [hubtelMerchantNumber, setHubtelMerchantNumber] = useState("");
  const [hubtelMerchant, setHubtelMerchant] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [hubtelActive, setHubtelActive] = useState(false);
  const [testingHubtel, setTestingHubtel] = useState(false);

  // SMS
  const [smsClientId, setSmsClientId] = useState("");
  const [smsSecret, setSmsSecret] = useState("");
  const [smsSecretSet, setSmsSecretSet] = useState(false);
  const [smsSender, setSmsSender] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [notifyCustomerSms, setNotifyCustomerSms] = useState(true);
  const [notifyStatusSms, setNotifyStatusSms] = useState(true);
  const [notifyAdminSms, setNotifyAdminSms] = useState(true);

  // Email
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpPassSet, setSmtpPassSet] = useState(false);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpTo, setSmtpTo] = useState("");
  const [notifyAdminEmail, setNotifyAdminEmail] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchJson<SettingsResponse>("/api/admin/settings", {
      headers: { "x-admin-token": token },
    })
      .then((res) => {
        if (cancelled) return;
        setAnnouncement(res.announcement);
        setShilohYear(res.shilohYear);
        setShilohTagline(res.shilohTagline);
        setShilohDates(res.shilohDates);
        setShilohStart(res.shilohStart);
        setHubtelClientId(res.hubtel.clientId);
        setHubtelSecretSet(res.hubtel.secretSet);
        setHubtelMerchantNumber(res.hubtel.merchantNumber);
        setHubtelMerchant(res.hubtel.merchantName);
        setSiteUrl(res.hubtel.siteUrl);
        setHubtelActive(res.hubtel.active);
        setSmsClientId(res.sms.clientId);
        setSmsSecretSet(res.sms.secretSet);
        setSmsSender(res.sms.sender);
        setAdminPhone(res.sms.adminPhone);
        setAdminEmail(res.sms.adminEmail);
        setNotifyCustomerSms(res.sms.notifyCustomer);
        setNotifyStatusSms(res.sms.notifyStatus);
        setNotifyAdminSms(res.sms.notifyAdmin);
        setSmtpHost(res.email.host);
        setSmtpPort(res.email.port || "587");
        setSmtpUser(res.email.user);
        setSmtpPassSet(res.email.passwordSet);
        setSmtpSecure(res.email.secure);
        setSmtpFrom(res.email.from);
        setSmtpTo(res.email.to);
        setNotifyAdminEmail(res.email.notifyAdmin);
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

  const save = async (key: string, body: Record<string, unknown>) => {
    setSavingKey(key);
    try {
      await fetchJson("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify(body),
      });
      await queryClient.invalidateQueries({ queryKey: ["store-info"] });
      // Refresh so the "configured" pills update immediately.
      const res = await fetchJson<SettingsResponse>("/api/admin/settings", {
        headers: { "x-admin-token": token },
      });
      setHubtelSecretSet(res.hubtel.secretSet);
      setHubtelActive(res.hubtel.active);
      setSmsSecretSet(res.sms.secretSet);
      setSmtpPassSet(res.email.passwordSet);
      setHubtelSecret("");
      setSmsSecret("");
      setSmtpPass("");
      toast({ title: "Settings saved" });
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const testHubtel = async () => {
    setTestingHubtel(true);
    try {
      const res = await fetch("/api/admin/settings/hubtel-test", {
        method: "POST",
        headers: { "x-admin-token": token },
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error?: string;
        hint?: string;
      };
      if (res.ok && data.success) {
        toast({ title: "Hubtel connected", description: data.message });
      } else {
        toast({
          title: "Hubtel test failed",
          description: [data.error, data.hint].filter(Boolean).join(" "),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Hubtel test failed",
        description: "Could not reach the server — please try again.",
        variant: "destructive",
      });
    } finally {
      setTestingHubtel(false);
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
      {/* ---------------- Hubtel payment ---------------- */}
      <CardShell
        icon={ShieldCheck}
        title="Hubtel Online Payment"
        subtitle="Activate one-tap checkout — Hubtel collects MoMo, wallets & cards"
        gold
        status={{ label: hubtelActive ? "Active" : "Not configured", ok: hubtelActive }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="hubtel-client-id"
            label="API Username"
            hint="Hubtel Online Checkout credential — from your Hubtel account → API Keys."
          >
            <Input
              id="hubtel-client-id"
              value={hubtelClientId}
              onChange={(e) => setHubtelClientId(e.target.value)}
              placeholder="e.g. hkPq2xyz…"
              className={`${inputCls} font-mono text-sm`}
              maxLength={120}
            />
          </Field>
          <Field
            id="hubtel-secret"
            label="API Key (Secret)"
            hint={
              hubtelSecretSet
                ? "A key is configured. Leave blank to keep it; type a new one to replace it."
                : "Paste the API Key that pairs with the API Username above."
            }
          >
            <Input
              id="hubtel-secret"
              type="password"
              value={hubtelSecret}
              onChange={(e) => setHubtelSecret(e.target.value)}
              placeholder={hubtelSecretSet ? "••••••••••  (configured)" : "e.g. 9f8e7d6c…"}
              className={`${inputCls} font-mono text-sm`}
              maxLength={120}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="hubtel-merchant-number"
            label="Merchant Account Number"
            hint="Required — Hubtel rejects checkouts without it."
          >
            <Input
              id="hubtel-merchant-number"
              value={hubtelMerchantNumber}
              onChange={(e) => setHubtelMerchantNumber(e.target.value)}
              placeholder="e.g. HM24010001"
              className={`${inputCls} font-mono text-sm`}
              maxLength={60}
            />
          </Field>
          <Field id="hubtel-merchant" label="Display name">
            <Input
              id="hubtel-merchant"
              value={hubtelMerchant}
              onChange={(e) => setHubtelMerchant(e.target.value)}
              placeholder="Shiloh Merch GH"
              className={inputCls}
              maxLength={60}
            />
          </Field>
        </div>
        <Field
          id="site-url"
          label="Public site URL"
          hint="Used for Hubtel payment callbacks. Must be reachable from the internet."
        >
          <Input
            id="site-url"
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            placeholder="https://shilohmerch.com"
            className={`${inputCls} text-sm`}
            maxLength={200}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Button
            onClick={() =>
              save("hubtel", {
                hubtelClientId: hubtelClientId.trim(),
                hubtelClientSecret: hubtelSecret.trim() ? hubtelSecret.trim() : undefined,
                hubtelMerchantNumber: hubtelMerchantNumber.trim(),
                hubtelMerchantName: hubtelMerchant.trim(),
                siteUrl: siteUrl.trim(),
              })
            }
            disabled={savingKey !== null || testingHubtel}
            className="h-12 w-full rounded-full bg-gradient-to-r from-gold to-gold-deep font-bold text-primary-foreground hover:opacity-95"
          >
            {savingKey === "hubtel" ? (
              <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" aria-hidden />
            ) : (
              <Save className="mr-2 h-4.5 w-4.5" aria-hidden />
            )}
            {hubtelActive ? "Save payment settings" : "Activate online payment"}
          </Button>
          <Button
            onClick={testHubtel}
            disabled={savingKey !== null || testingHubtel || !hubtelActive}
            variant="outline"
            className="h-12 rounded-full border-gold/50 px-5 font-semibold text-gold hover:bg-gold/10 disabled:opacity-50"
          >
            {testingHubtel ? (
              <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" aria-hidden />
            ) : (
              <PlugZap className="mr-2 h-4.5 w-4.5" aria-hidden />
            )}
            Test connection
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          When active, customers are taken straight to Hubtel&apos;s secure checkout after placing an
          order. Payment status flows back automatically and paid orders move to{" "}
          <span className="font-semibold text-foreground">Under review</span>. Save your
          credentials first, then hit <span className="font-semibold text-foreground">Test connection</span> to
          verify them against the live Hubtel API.
        </p>
      </CardShell>

      {/* ---------------- SMS alerts ---------------- */}
      <CardShell
        icon={MessageSquare}
        title="SMS Alerts (Hubtel)"
        subtitle="Order & payment confirmations to the customer and your phone"
        status={{ label: smsSecretSet ? "Configured" : "Not configured", ok: smsSecretSet }}
      >
        <div className="grid grid-cols-2 gap-4">
          <Field id="sms-client-id" label="SMS API Key">
            <Input
              id="sms-client-id"
              value={smsClientId}
              onChange={(e) => setSmsClientId(e.target.value)}
              placeholder="e.g. rQ3vNoP…"
              className={`${inputCls} font-mono text-sm`}
              maxLength={120}
            />
          </Field>
          <Field id="sms-secret" label="SMS API Secret">
            <Input
              id="sms-secret"
              type="password"
              value={smsSecret}
              onChange={(e) => setSmsSecret(e.target.value)}
              placeholder={smsSecretSet ? "••••••••••  (configured)" : "API secret / password"}
              className={`${inputCls} font-mono text-sm`}
              maxLength={120}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <Field
          id="sms-sender"
          label="Sender ID"
          hint="The name recipients see — must be registered on your Hubtel account."
        >
          <Input
            id="sms-sender"
            value={smsSender}
            onChange={(e) => setSmsSender(e.target.value)}
            placeholder="Shiloh Merch"
            className={inputCls}
            maxLength={20}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="admin-phone" label="Admin phone (alert number)">
            <Input
              id="admin-phone"
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
              placeholder="024 123 4567"
              className={`${inputCls} font-mono text-base`}
              maxLength={20}
            />
          </Field>
          <Field id="admin-email" label="Admin email">
            <Input
              id="admin-email"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="orders@shilohmerch.com"
              className={`${inputCls} text-sm`}
              maxLength={120}
            />
          </Field>
        </div>
        <div className="grid gap-3 rounded-2xl border border-border bg-background/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="notify-customer-sms" className="text-sm font-semibold">
              SMS the customer on order &amp; payment
            </Label>
            <Switch
              id="notify-customer-sms"
              checked={notifyCustomerSms}
              onCheckedChange={setNotifyCustomerSms}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label htmlFor="notify-status-sms" className="text-sm font-semibold">
                SMS the customer on status changes
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sent automatically when an order is marked contacted, fulfilled or cancelled.
              </p>
            </div>
            <Switch
              id="notify-status-sms"
              checked={notifyStatusSms}
              onCheckedChange={setNotifyStatusSms}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="notify-admin-sms" className="text-sm font-semibold">
              SMS the admin phone on order &amp; payment
            </Label>
            <Switch
              id="notify-admin-sms"
              checked={notifyAdminSms}
              onCheckedChange={setNotifyAdminSms}
            />
          </div>
        </div>
        <Button
          onClick={() =>
            save("sms", {
              smsClientId: smsClientId.trim(),
              smsClientSecret: smsSecret.trim() ? smsSecret.trim() : undefined,
              smsSender: smsSender.trim(),
              adminPhone: adminPhone.trim(),
              adminEmail: adminEmail.trim(),
              notifyCustomerSms,
              notifyStatusSms,
              notifyAdminSms,
            })
          }
          disabled={savingKey !== null}
          className="h-12 w-full rounded-full font-bold"
          variant="outline"
        >
          {savingKey === "sms" ? (
            <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" aria-hidden />
          ) : (
            <BellRing className="mr-2 h-4.5 w-4.5" aria-hidden />
          )}
          Save SMS settings
        </Button>
      </CardShell>

      {/* ---------------- Email alerts ---------------- */}
      <CardShell
        icon={Mail}
        title="Email Alerts (SMTP)"
        subtitle="Every new order & payment lands in your inbox"
        status={{ label: smtpPassSet ? "Configured" : "Not configured", ok: smtpPassSet }}
      >
        <div className="grid grid-cols-[1fr_120px] gap-4">
          <Field id="smtp-host" label="SMTP host">
            <Input
              id="smtp-host"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
              placeholder="smtp.gmail.com"
              className={`${inputCls} text-sm`}
              maxLength={120}
            />
          </Field>
          <Field id="smtp-port" label="Port">
            <Input
              id="smtp-port"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
              placeholder="587"
              inputMode="numeric"
              className={`${inputCls} font-mono text-base`}
              maxLength={6}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field id="smtp-user" label="SMTP username">
            <Input
              id="smtp-user"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="orders@shilohmerch.com"
              className={`${inputCls} text-sm`}
              maxLength={120}
              autoComplete="off"
            />
          </Field>
          <Field id="smtp-pass" label="SMTP password / app password">
            <Input
              id="smtp-pass"
              type="password"
              value={smtpPass}
              onChange={(e) => setSmtpPass(e.target.value)}
              placeholder={smtpPassSet ? "••••••••••  (configured)" : "Gmail: use an app password"}
              className={`${inputCls} text-sm`}
              maxLength={200}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field id="smtp-from" label="From address">
            <Input
              id="smtp-from"
              type="email"
              value={smtpFrom}
              onChange={(e) => setSmtpFrom(e.target.value)}
              placeholder="shiloh.merch@gmail.com"
              className={`${inputCls} text-sm`}
              maxLength={120}
            />
          </Field>
          <Field id="smtp-to" label="Deliver alerts to">
            <Input
              id="smtp-to"
              type="email"
              value={smtpTo}
              onChange={(e) => setSmtpTo(e.target.value)}
              placeholder="orders@shilohmerch.com"
              className={`${inputCls} text-sm`}
              maxLength={120}
            />
          </Field>
        </div>
        <div className="grid gap-3 rounded-2xl border border-border bg-background/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="smtp-secure" className="text-sm font-semibold">
              Use TLS-on-connect (port 465)
            </Label>
            <Switch id="smtp-secure" checked={smtpSecure} onCheckedChange={setSmtpSecure} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="notify-admin-email" className="text-sm font-semibold">
              Email me on every order &amp; payment
            </Label>
            <Switch
              id="notify-admin-email"
              checked={notifyAdminEmail}
              onCheckedChange={setNotifyAdminEmail}
            />
          </div>
        </div>
        <Button
          onClick={() =>
            save("email", {
              smtpHost: smtpHost.trim(),
              smtpPort: smtpPort.trim(),
              smtpUser: smtpUser.trim(),
              smtpPass: smtpPass.trim() ? smtpPass.trim() : undefined,
              smtpSecure,
              smtpFromEmail: smtpFrom.trim(),
              smtpToEmail: smtpTo.trim(),
              notifyAdminEmail,
            })
          }
          disabled={savingKey !== null}
          className="h-12 w-full rounded-full font-bold"
          variant="outline"
        >
          {savingKey === "email" ? (
            <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" aria-hidden />
          ) : (
            <Mail className="mr-2 h-4.5 w-4.5" aria-hidden />
          )}
          Save email settings
        </Button>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Tip: send a test SMS / email from the Alerts tab after saving to confirm delivery.
        </p>
      </CardShell>

      {/* ---------------- Branding ---------------- */}
      <CardShell
        icon={Sparkles}
        title="Shiloh Branding"
        subtitle="Drives the headline, dates and countdown — update every year"
      >
        <div className="grid grid-cols-2 gap-4">
          <Field id="shiloh-year" label="Year">
            <Input
              id="shiloh-year"
              value={shilohYear}
              onChange={(e) => setShilohYear(e.target.value)}
              placeholder="2026"
              inputMode="numeric"
              maxLength={4}
              className={`${inputCls} text-base`}
            />
          </Field>
          <Field id="shiloh-start" label="Starts on">
            <Input
              id="shiloh-start"
              value={shilohStart}
              onChange={(e) => setShilohStart(e.target.value)}
              placeholder="2026-12-08"
              className={`${inputCls} font-mono text-base`}
            />
          </Field>
        </div>
        <Field id="shiloh-tagline" label="Tagline (theme)">
          <Input
            id="shiloh-tagline"
            value={shilohTagline}
            onChange={(e) => setShilohTagline(e.target.value)}
            placeholder="Far Above"
            className={`${inputCls} text-base`}
            maxLength={60}
          />
        </Field>
        <Field id="shiloh-dates" label="Dates label">
          <Input
            id="shiloh-dates"
            value={shilohDates}
            onChange={(e) => setShilohDates(e.target.value)}
            placeholder="December 8–13"
            className={`${inputCls} text-base`}
            maxLength={60}
          />
        </Field>
        <Button
          onClick={() => {
            if (!/^\d{4}$/.test(shilohYear.trim())) {
              toast({ title: "Invalid year", description: "Enter a 4-digit year, e.g. 2026.", variant: "destructive" });
              return;
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(shilohStart.trim())) {
              toast({ title: "Invalid start date", description: "Use YYYY-MM-DD, e.g. 2026-12-08.", variant: "destructive" });
              return;
            }
            save("branding", {
              shilohYear: shilohYear.trim(),
              shilohTagline: shilohTagline.trim(),
              shilohDates: shilohDates.trim(),
              shilohStart: shilohStart.trim(),
            });
          }}
          disabled={savingKey !== null}
          className="h-12 w-full rounded-full bg-gradient-to-r from-gold to-gold-deep font-bold text-primary-foreground hover:opacity-95"
        >
          {savingKey === "branding" ? (
            <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" aria-hidden />
          ) : (
            <Save className="mr-2 h-4.5 w-4.5" aria-hidden />
          )}
          Save event branding
        </Button>
      </CardShell>

      {/* ---------------- Storefront ---------------- */}
      <CardShell
        icon={Wallet}
        title="Storefront"
        subtitle="Customer-facing store settings"
        status={{ label: "Live", ok: true }}
      >
        <Field id="announcement" label="Announcement bar text" hint="Leave empty to hide the top bar.">
          <Input
            id="announcement"
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="Order early — delivery before Dec 8"
            className={inputCls}
            maxLength={160}
          />
        </Field>
        <Button
          onClick={() =>
            save("store", {
              announcement: announcement.trim(),
            })
          }
          disabled={savingKey !== null}
          className="h-12 w-full rounded-full bg-gradient-to-r from-gold to-gold-deep font-bold text-primary-foreground hover:opacity-95"
        >
          {savingKey === "store" ? (
            <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" aria-hidden />
          ) : (
            <Save className="mr-2 h-4.5 w-4.5" aria-hidden />
          )}
          Save store settings
        </Button>
      </CardShell>

      {/* ---------------- Password ---------------- */}
      <CardShell
        icon={KeyRound}
        title="Back office password"
        subtitle="Changing it signs out every other device"
      >
        <Field id="new-password" label="New password">
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 6 characters"
            className={inputCls}
            autoComplete="new-password"
          />
        </Field>
        <Field id="confirm-password" label="Confirm new password">
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat the new password"
            className={inputCls}
            autoComplete="new-password"
          />
        </Field>
        <Button
          onClick={async () => {
            if (newPassword.length < 6) {
              toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
              return;
            }
            if (newPassword !== confirmPassword) {
              toast({ title: "Passwords do not match", variant: "destructive" });
              return;
            }
            await save("password", { newPassword });
            setNewPassword("");
            setConfirmPassword("");
          }}
          disabled={savingKey !== null || !newPassword}
          variant="outline"
          className="h-12 w-full rounded-full border-border font-semibold hover:border-gold/40 hover:text-gold"
        >
          {savingKey === "password" ? (
            <Loader2 className="mr-2 h-4.5 w-4.5 animate-spin" aria-hidden />
          ) : (
            <Settings2 className="mr-2 h-4.5 w-4.5" aria-hidden />
          )}
          Change password
        </Button>
      </CardShell>
    </div>
  );
}
