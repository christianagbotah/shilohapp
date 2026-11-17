"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCcw,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchJson } from "@/hooks/use-store-data";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export type NotificationLogDTO = {
  id: string;
  channel: "sms" | "email" | string;
  recipient: string;
  purpose: string;
  status: "sent" | "failed" | "skipped" | string;
  detail: string | null;
  orderCode: string | null;
  createdAt: string;
};

const PURPOSE_LABELS: Record<string, string> = {
  order_placed_customer: "Order placed → customer",
  order_placed_admin: "Order placed → admin",
  payment_confirmed_customer: "Payment confirmed → customer",
  payment_confirmed_admin: "Payment confirmed → admin",
  test: "Test message",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wide",
        status === "sent" && "bg-emerald-500/15 text-emerald-400",
        status === "failed" && "bg-destructive/15 text-destructive",
        status === "skipped" && "bg-secondary text-muted-foreground"
      )}
    >
      {status}
    </span>
  );
}

export function AdminAlerts({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [testing, setTesting] = useState<"sms" | "email" | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-notifications", token],
    refetchInterval: 30_000,
    queryFn: () =>
      fetchJson<{ logs: NotificationLogDTO[] }>("/api/admin/notifications", {
        headers: { "x-admin-token": token },
      }),
  });

  const sendTest = async (channel: "sms" | "email") => {
    setTesting(channel);
    try {
      const res = await fetchJson<{ result: string; message: string }>(
        "/api/admin/notifications",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-token": token },
          body: JSON.stringify({ channel }),
        }
      );
      toast({
        title: res.result === "sent" ? "Test sent" : res.result === "skipped" ? "Skipped" : "Test failed",
        description: res.message,
        variant: res.result === "failed" ? "destructive" : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    } catch (err) {
      toast({
        title: "Could not send test",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setTesting(null);
    }
  };

  const logs = data?.logs ?? [];
  const sent = logs.filter((l) => l.status === "sent").length;
  const failed = logs.filter((l) => l.status === "failed").length;
  const skipped = logs.filter((l) => l.status === "skipped").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary + test actions */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-muted-foreground">
            Delivered (recent)
          </p>
          <p className="mt-1.5 font-display text-2xl font-bold text-emerald-400">{sent}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-muted-foreground">
            Failed (recent)
          </p>
          <p className="mt-1.5 font-display text-2xl font-bold text-destructive">{failed}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-muted-foreground">
            Skipped — not configured
          </p>
          <p className="mt-1.5 font-display text-2xl font-bold text-muted-foreground">{skipped}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => sendTest("sms")}
          disabled={testing !== null}
          className="rounded-full font-semibold"
          variant="outline"
        >
          {testing === "sms" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <MessageSquare className="mr-2 h-4 w-4" aria-hidden />
          )}
          Send test SMS
        </Button>
        <Button
          onClick={() => sendTest("email")}
          disabled={testing !== null}
          className="rounded-full font-semibold"
          variant="outline"
        >
          {testing === "email" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Mail className="mr-2 h-4 w-4" aria-hidden />
          )}
          Send test email
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          aria-label="Refresh alerts"
          className="h-10 w-10 rounded-full"
        >
          <RefreshCcw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden />
        </Button>
        <p className="ml-auto text-xs text-muted-foreground">
          Tests go to the admin phone / email set in Settings.
        </p>
      </div>

      {/* Log */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading alerts…
        </div>
      ) : isError || !data ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Could not load the notification log.{" "}
          <button onClick={() => refetch()} className="font-semibold text-gold hover:underline">
            Retry
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <BellRing className="h-9 w-9 text-muted-foreground" aria-hidden />
          <p className="max-w-sm text-sm text-muted-foreground">
            No alerts yet. Every SMS and email the system sends — order confirmations, payment
            receipts, tests — is recorded here.
          </p>
        </div>
      ) : (
        <ul className="grid gap-2">
          {logs.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-border bg-card px-4 py-3 text-sm"
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  l.channel === "sms" ? "bg-gold/15 text-gold" : "bg-purple-500/15 text-purple-300"
                )}
                aria-hidden
              >
                {l.channel === "sms" ? (
                  <MessageSquare className="h-4 w-4" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {PURPOSE_LABELS[l.purpose] ?? l.purpose}
                  {l.orderCode ? (
                    <span className="font-mono text-xs font-bold text-gold">{l.orderCode}</span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  To {l.recipient} • {new Date(l.createdAt).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {l.detail ? ` • ${l.detail}` : ""}
                </p>
              </div>
              <StatusPill status={l.status} />
              {l.status === "failed" ? (
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
              ) : l.status === "sent" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Send className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Configure the Hubtel SMS and email alert credentials under Settings to activate delivery.
      </p>
    </div>
  );
}
