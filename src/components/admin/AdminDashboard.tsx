"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
  ChevronDown,
  ExternalLink,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  X,
  BarChart3,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Loader2,
  LogOut,
  Package,
  PenLine,
  Phone,
  Printer,
  RefreshCcw,
  Search,
  Settings2,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUi } from "@/store/ui";
import { fetchJson, useStoreInfo } from "@/hooks/use-store-data";
import { useToast } from "@/hooks/use-toast";
import { formatGhs } from "@/lib/format";
import { BrandLogo } from "@/components/store/BrandLogo";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  STORE_INFO_DEFAULTS,
  type AdminStats,
  type OrderDTO,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { AdminContent } from "@/components/admin/AdminContent";
import { AdminAlerts } from "@/components/admin/AdminAlerts";
import { AdminProducts } from "@/components/admin/AdminProducts";
import { AdminInsights } from "@/components/admin/AdminInsights";
import { PrintRoot, type PrintJob } from "@/components/admin/AdminPrint";

// Ensure lucide icon typing stays consistent for StatCard
import type { LucideIcon } from "lucide-react";

type AdminOrdersResponse = { orders: OrderDTO[]; stats: AdminStats };

export function useAdminOrders() {
  const token = useUi((s) => s.adminToken);
  const setAdminToken = useUi((s) => s.setAdminToken);
  return useQuery({
    queryKey: ["admin-orders", token],
    refetchInterval: 30_000,
    queryFn: async () => {
      try {
        return await fetchJson<AdminOrdersResponse>("/api/admin/orders", {
          headers: { "x-admin-token": token ?? "" },
        });
      } catch (err) {
        if (err instanceof Error && err.message === "Unauthorized") {
          setAdminToken(null);
        }
        throw err;
      }
    },
    enabled: !!token,
  });
}

async function adminPatch(
  url: string,
  token: string,
  body: Record<string, unknown>
): Promise<void> {
  await fetchJson(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-token": token },
    body: JSON.stringify(body),
  });
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide",
        status === "pending" && "bg-secondary text-muted-foreground",
        status === "reviewing" && "bg-purple-500/15 text-purple-300",
        status === "contacted" && "bg-gold/15 text-gold",
        status === "fulfilled" && "bg-emerald-500/15 text-emerald-400",
        status === "cancelled" && "bg-destructive/15 text-destructive"
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide",
        status === "unpaid" && "bg-secondary text-muted-foreground",
        status === "verifying" && "bg-amber-500/15 text-amber-400",
        status === "paid" && "bg-emerald-500/15 text-emerald-400"
      )}
    >
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        highlight ? "gold-panel" : "border-border bg-card"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <Icon className={cn("h-4.5 w-4.5", highlight ? "text-gold" : "text-muted-foreground")} aria-hidden />
      </div>
      <p
        className={cn(
          "mt-2 font-display text-2xl font-bold tabular-nums",
          highlight && "text-gold"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function OrderDetail({
  order,
  token,
  onClose,
  onPrint,
}: {
  order: OrderDTO;
  token: string;
  onClose: () => void;
  onPrint: (order: OrderDTO) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [notes, setNotes] = useState(order.adminNotes ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [manualReference, setManualReference] = useState("");

  const act = async (label: string, body: Record<string, unknown>) => {
    setBusy(label);
    try {
      await adminPatch(`/api/admin/orders/${order.id}`, token, body);
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: `Order ${order.code} updated` });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto pretty-scroll rounded-2xl border-border bg-card p-0 sm:max-w-lg">
      <DialogHeader className="border-b border-border p-5">
        <DialogTitle className="flex flex-wrap items-center gap-3">
          <span className="font-display text-xl font-bold tracking-wider text-gold">{order.code}</span>
          <StatusBadge status={order.status} />
          <PaymentBadge status={order.paymentStatus} />
        </DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Placed {new Date(order.createdAt).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {order.paymentMethod ? (
            <span className="text-muted-foreground">
              • {PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}
              {order.paidAt
                ? ` on ${new Date(order.paidAt).toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : ""}
            </span>
          ) : null}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-5 p-5">
        {order.adminNotes?.startsWith("[LIVE_PAYMENT_QA]") ? (
          <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-sm font-semibold text-amber-300">
            Administrator live-money PAYMENT TEST — this is not a merchandise order. Do not fulfil, ship or contact for delivery.
          </p>
        ) : null}
        {/* Customer */}
        <section className="grid gap-3 rounded-2xl border border-border bg-background/60 p-4 sm:grid-cols-2">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">Customer</p>
            <p className="mt-1 text-sm font-semibold">{order.fullName}</p>
          </div>
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">Phone</p>
            <a
              href={`tel:${order.phone}`}
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:underline"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden />
              {order.phone}
            </a>
          </div>
          <div className="sm:col-span-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
              Address
            </p>
            <p className="mt-1 text-sm">{order.address || "— not provided —"}</p>
          </div>
        </section>

        {/* Items */}
        <section>
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
            Items ({order.items.reduce((n, i) => n + i.quantity, 0)} units)
          </p>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-background/60">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 p-3.5 text-sm">
                <div>
                  <p className="font-semibold">
                    {item.quantity} × {item.productName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.color} • {item.size}
                    {item.capStyle ? ` • ${item.capStyle}` : ""} •{" "}
                    {item.ageGroup === "kid" ? "Kids" : "Adult"}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-gold">
                  {formatGhs(item.unitPrice * item.quantity)}
                </p>
              </li>
            ))}
            <li className="flex items-center justify-between p-3.5">
              <span className="text-sm font-semibold">Total — order {order.code}</span>
              <span className="font-display text-lg font-bold text-gold">{formatGhs(order.total)}</span>
            </li>
          </ul>
        </section>

        {/* Actions */}
        <section className="flex flex-col gap-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
            Payment actions
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => onPrint(order)}
              className="rounded-full border-gold/40 font-semibold text-gold hover:bg-gold/10"
            >
              <Printer className="mr-2 h-4 w-4" aria-hidden />
              Print invoice
            </Button>
            {order.paymentStatus === "paid" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Payment verified
              </span>
            ) : order.paymentStatus === "verifying" || order.paymentMethod === "hubtel" ? (
              <Button
                variant="outline"
                disabled={busy !== null}
                onClick={async () => {
                  setBusy("recheck");
                  try {
                    await fetchJson(`/api/admin/orders/${order.id}/reconcile`, { method: "POST" });
                    await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
                    toast({ title: "Hubtel payment status checked" });
                  } catch (err) {
                    toast({ title: "Verification unavailable", description: err instanceof Error ? err.message : "Try again later", variant: "destructive" });
                  } finally { setBusy(null); }
                }}
                className="rounded-full border-gold/50 text-gold"
              >
                <RefreshCcw className="mr-2 h-4 w-4" aria-hidden /> Recheck Hubtel
              </Button>
            ) : (
              <div className="w-full space-y-2 rounded-xl border border-border bg-background/60 p-3">
                <Label htmlFor="manual-payment-ref" className="text-sm font-semibold">Manual payment receipt/reference</Label>
                <p className="text-xs text-muted-foreground">Only confirm money verified outside Hubtel. This action creates an audit record.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="manual-payment-ref"
                    value={manualReference}
                    onChange={(e) => setManualReference(e.target.value)}
                    placeholder="Bank/MoMo receipt or cash reference"
                    maxLength={100}
                    className="h-10 flex-1"
                  />
                  <Button
                    onClick={() => act("paid", { manualPaymentReference: manualReference.trim() })}
                    disabled={busy !== null || manualReference.trim().length < 6}
                    className="rounded-full bg-emerald-500 text-black hover:bg-emerald-400"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden /> Confirm manual payment
                  </Button>
                </div>
              </div>
            )}
            {order.paymentStatus === "verifying" ? (
              <p className="w-full text-xs text-amber-400">
                Hubtel payment is still being verified. Do not ask the customer to pay again or release items yet.
              </p>
            ) : null}
          </div>

          <p className="mt-2 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
            Order status
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Marking an order <span className="font-semibold text-foreground">contacted</span>,{" "}
            <span className="font-semibold text-foreground">fulfilled</span> or{" "}
            <span className="font-semibold text-foreground">cancelled</span> texts the customer
            automatically (see Settings → SMS alerts).
          </p>
          <div className="flex flex-wrap gap-2">
            {order.status !== "fulfilled" && order.status !== "cancelled" ? (
              <>
                {order.status === "pending" ? (
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => act("reviewing", { status: "reviewing" })}
                    className="rounded-full font-semibold"
                  >
                    Start review
                  </Button>
                ) : null}
                {order.status !== "contacted" ? (
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => act("contacted", { status: "contacted" })}
                    className="rounded-full font-semibold"
                  >
                    Mark contacted
                  </Button>
                ) : null}
                <Button
                  disabled={busy !== null || order.paymentStatus !== "paid"}
                  title={order.paymentStatus !== "paid" ? "Payment must be verified before fulfillment" : undefined}
                  onClick={() => act("fulfilled", { status: "fulfilled" })}
                  className="rounded-full bg-gradient-to-r from-gold to-gold-deep font-bold text-primary-foreground hover:opacity-95"
                >
                  Mark fulfilled
                </Button>
                <Button
                  variant="outline"
                  disabled={busy !== null || order.paymentStatus === "paid"}
                  title={order.paymentStatus === "paid" ? "Paid orders require refund handling" : undefined}
                  onClick={() => act("cancelled", { status: "cancelled" })}
                  className="rounded-full border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  Cancel order
                </Button>
              </>
            ) : order.status === "cancelled" ? (
              <Button
                variant="secondary"
                disabled={busy !== null}
                onClick={() => act("restore", { status: "pending" })}
                className="rounded-full font-semibold"
              >
                Restore to pending
              </Button>
            ) : (
              <p className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> This order is fulfilled
              </p>
            )}
          </div>
        </section>

        {/* Notes */}
        <section className="grid gap-2">
          <Label htmlFor="admin-notes" className="text-sm font-semibold">
            Internal notes
          </Label>
          <Textarea
            id="admin-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Follow-up details, delivery arrangement, payment confirmation time…"
            className="min-h-[72px] rounded-xl border-border bg-background/60"
            maxLength={500}
          />
          <Button
            variant="outline"
            disabled={busy !== null || notes === (order.adminNotes ?? "")}
            onClick={() => act("notes", { adminNotes: notes })}
            className="self-start rounded-full border-border font-semibold"
          >
            {busy === "notes" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            Save notes
          </Button>
        </section>
      </div>
      </DialogContent>
    </Dialog>
  );
}

function exportOrdersCsv(orders: OrderDTO[]) {
  const header = [
    "Code",
    "Placed at",
    "Customer",
    "Phone",
    "Address",
    "Items",
    "Total (₵)",
    "Payment status",
    "Payment method",
    "Paid at",
    "Order status",
    "Notes",
  ];
  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const rows = orders.map((o) => [
    o.code,
    new Date(o.createdAt).toLocaleString("en-GB"),
    o.fullName,
    o.phone,
    o.address ?? "",
    o.items
      .map((i) => `${i.quantity}x ${i.productName} (${i.color}/${i.size}${i.capStyle ? `/${i.capStyle}` : ""})`)
      .join("; "),
    o.total.toFixed(2),
    o.paymentStatus,
    o.paymentMethod ?? "",
    o.paidAt ? new Date(o.paidAt).toLocaleString("en-GB") : "",
    o.status,
    o.adminNotes ?? "",
  ].map(escape).join(","));
  const csv = [header.map(escape).join(","), ...rows].join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shiloh-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function OrdersPanel({
  token,
  onPrintInvoice,
  onPrintManifest,
}: {
  token: string;
  onPrintInvoice: (order: OrderDTO) => void;
  onPrintManifest: (orders: OrderDTO[]) => void;
}) {
  const { data, isLoading, isError, refetch, isFetching } = useAdminOrders();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Always read the selected order from the (fresh) query cache
  const selected = useMemo(
    () => data?.orders.find((o) => o.id === selectedId) ?? null,
    [data, selectedId]
  );

  const orders = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (paymentFilter !== "all" && o.paymentStatus !== paymentFilter) return false;
      if (!q) return true;
      return (
        o.code.toLowerCase().includes(q) ||
        o.fullName.toLowerCase().includes(q) ||
        o.phone.includes(q)
      );
    });
  }, [data, search, statusFilter, paymentFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code, name or phone…"
            className="h-11 rounded-xl border-border bg-card pl-10"
            aria-label="Search orders"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 w-[150px] rounded-xl border-border bg-card" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending review</SelectItem>
              <SelectItem value="reviewing">Under review</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="fulfilled">Fulfilled</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="h-11 w-[160px] rounded-xl border-border bg-card" aria-label="Filter by payment">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payments</SelectItem>
              <SelectItem value="unpaid">Awaiting payment</SelectItem>
              <SelectItem value="verifying">Verifying</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => refetch()}
            aria-label="Refresh orders"
            className="h-11 w-11 shrink-0 rounded-xl border-border bg-card"
          >
            <RefreshCcw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden />
          </Button>
        </div>
      </div>

      {/* Batch actions */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 p-3">
        <p className="mr-auto text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {orders.length} order{orders.length === 1 ? "" : "s"} in view
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={orders.length === 0}
          onClick={() => onPrintManifest(orders)}
          className="h-9 rounded-full border-border font-semibold hover:border-gold/40 hover:text-gold"
        >
          <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Print manifest
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={orders.length === 0}
          onClick={() => exportOrdersCsv(orders)}
          className="h-9 rounded-full border-border font-semibold hover:border-gold/40 hover:text-gold"
        >
          <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Export CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading orders…
        </div>
      ) : isError || !data ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Could not load orders.{" "}
          <button onClick={() => refetch()} className="font-semibold text-gold hover:underline">
            Retry
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Package className="h-9 w-9 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {data.orders.length === 0
              ? "No orders yet — they'll appear here the moment someone checks out."
              : "No orders match your filters."}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <button
                type="button"
                onClick={() => setSelectedId(order.id)}
                className="card-hover w-full rounded-2xl border border-border bg-card p-4 text-left"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base font-bold tracking-wider text-gold">
                      {order.code}
                    </span>
                    {order.adminNotes?.startsWith("[LIVE_PAYMENT_QA]") ? (
                      <span className="rounded-lg border border-amber-500/35 px-2 py-1 text-xs font-bold text-amber-300">PAYMENT QA — NO GOODS</span>
                    ) : null}
                    <StatusBadge status={order.status} />
                    <PaymentBadge status={order.paymentStatus} />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <p className="font-semibold">{order.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.phone} • {order.items.reduce((n, i) => n + i.quantity, 0)} units
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-base font-bold text-gold">
                      {formatGhs(order.total)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <OrderDetail
          key={selected.id + selected.status + selected.paymentStatus}
          order={selected}
          token={token}
          onClose={() => setSelectedId(null)}
          onPrint={onPrintInvoice}
        />
      ) : null}
    </div>
  );
}

type BackOfficePage =
  | "overview"
  | "orders"
  | "insights"
  | "products"
  | "content"
  | "alerts"
  | "settings";

type NavigationItem = {
  id: BackOfficePage;
  label: string;
  detail: string;
  icon: LucideIcon;
};

const BACKOFFICE_GROUPS: { label: string; items: NavigationItem[] }[] = [
  {
    label: "WORKSPACE",
    items: [
      { id: "overview", label: "Overview", detail: "Store activity and tasks", icon: LayoutDashboard },
      { id: "orders", label: "Orders", detail: "Customers and fulfillment", icon: ShoppingBag },
      { id: "insights", label: "Reports & insights", detail: "Sales performance", icon: BarChart3 },
    ],
  },
  {
    label: "STOREFRONT",
    items: [
      { id: "products", label: "Products", detail: "Catalog and pricing", icon: Package },
      { id: "content", label: "Site content", detail: "Homepage and copy", icon: PenLine },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { id: "alerts", label: "Notifications", detail: "Message delivery", icon: BellRing },
      { id: "settings", label: "Settings", detail: "Brand, payment and access", icon: Settings2 },
    ],
  },
];
const PAGE_DETAILS = BACKOFFICE_GROUPS.flatMap((group) => group.items);

function pageFromUrl(): BackOfficePage {
  if (typeof window === "undefined") return "overview";
  const requested = new URLSearchParams(window.location.search).get("section");
  return PAGE_DETAILS.some((page) => page.id === requested)
    ? (requested as BackOfficePage)
    : "overview";
}

function OverviewPanel({
  data,
  loading,
  onNavigate,
  paymentsActive,
  error,
  onRefresh,
}: {
  data: AdminOrdersResponse | undefined;
  loading: boolean;
  onNavigate: (page: BackOfficePage) => void;
  paymentsActive: boolean;
  error: boolean;
  onRefresh: () => void;
}) {
  const recentOrders = (data?.orders ?? [])
    .filter((order) => !order.adminNotes?.startsWith("[LIVE_PAYMENT_QA]"))
    .slice(0, 5);
  const pending = data?.stats.pendingReview ?? 0;
  const verifying = data?.stats.verifyingPayment ?? 0;

  return (
    <div className="grid gap-6">
      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm">
          <span>Order data could not be refreshed. The figures below may not be available.</span>
          <button type="button" onClick={onRefresh} className="font-bold text-gold underline-offset-2 hover:underline">Retry loading</button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard icon={ShoppingBag} label="Total orders" value={loading ? "…" : String(data?.stats.totalOrders ?? "—")} />
        <StatCard icon={Clock3} label="Pending review" value={loading ? "…" : String(pending)} />
        <StatCard icon={Wallet} label="Verifying payment" value={loading ? "…" : String(verifying)} highlight />
        <StatCard icon={Banknote} label="Paid revenue" value={loading ? "…" : formatGhs(data?.stats.paidRevenue ?? 0)} highlight />
        <StatCard icon={Package} label="Units sold" value={loading ? "…" : String(data?.stats.totalUnits ?? 0)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)]">
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="bo-priorities">
          <div className="mb-5">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-gold">YOUR WORK QUEUE</p>
            <h3 id="bo-priorities" className="mt-1 font-display text-lg font-bold">What needs attention</h3>
            <p className="mt-1 text-xs text-muted-foreground">Your next actions, all in one place.</p>
          </div>
          <div className="grid gap-2">
            {([
              { title: "Review new orders", sub: "Check customer details and follow up", count: pending, icon: Clock3, page: "orders" },
              { title: "Check payments", sub: "Review transactions still verifying", count: verifying, icon: Wallet, page: "orders" },
            ] as const).map((task) => (
              <button
                key={task.title}
                type="button"
                onClick={() => onNavigate(task.page)}
                className="group flex w-full items-center gap-3 rounded-xl border border-border bg-background/55 px-4 py-3 text-left transition-colors hover:border-gold/40 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-gold">
                  <task.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{task.title}</span>
                  <span className="block text-xs text-muted-foreground">{task.sub}</span>
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-sm font-bold tabular-nums">{loading ? "…" : task.count}</span>
                <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </button>
            ))}
            <button
              type="button"
              onClick={() => onNavigate("products")}
              className="group flex w-full items-center gap-3 rounded-xl border border-border bg-background/55 px-4 py-3 text-left transition-colors hover:border-gold/40 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-gold">
                <Package className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Manage your catalogue</span>
                <span className="block text-xs text-muted-foreground">Product details, images and prices</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </button>
          </div>
        </section>

        <section className="flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="bo-readiness">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-gold">STORE OPERATIONS</p>
          <h3 id="bo-readiness" className="mt-1 font-display text-lg font-bold">Store health</h3>
          <div className="mt-5 space-y-4">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-400" aria-hidden />
              <div>
                <p className="text-sm font-semibold">Back Office session protected</p>
                <p className="text-xs text-muted-foreground">Administrator sign-in is required.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Wallet className={cn("mt-0.5 size-5 shrink-0", paymentsActive ? "text-emerald-400" : "text-amber-400")} aria-hidden />
              <div>
                <p className="text-sm font-semibold">{paymentsActive ? "Online checkout enabled" : "Online checkout not activated"}</p>
                <p className="text-xs text-muted-foreground">
                  {paymentsActive ? "Monitor transaction verification and order status." : "Orders can be taken. Verify and configure the payment provider before accepting online payments."}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-auto pt-6">
            <button
              type="button"
              onClick={() => onNavigate("settings")}
              className="flex w-full items-center justify-between rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-left text-sm font-semibold text-gold transition-colors hover:bg-gold/15"
            >
              Review store settings
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6" aria-labelledby="bo-recent-orders">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="bo-recent-orders" className="font-display text-lg font-bold">Recent orders</h3>
            <p className="mt-1 text-xs text-muted-foreground">Most recently placed customer orders</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => onNavigate("orders")}>
            View all orders <ChevronRight className="ml-1.5 size-4" aria-hidden />
          </Button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 py-9 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden /> Loading orders…</div>
        ) : recentOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background/40 px-5 py-10 text-center text-sm text-muted-foreground">
            No orders yet. New orders will appear here as customers check out.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => onNavigate("orders")}
                className="flex w-full flex-wrap items-center gap-3 py-3 text-left transition-colors hover:text-gold focus-visible:outline-2 focus-visible:outline-gold"
              >
                <div className="min-w-[135px] flex-1">
                  <p className="text-sm font-semibold">{order.code}</p>
                  <p className="text-xs text-muted-foreground">{order.fullName}</p>
                </div>
                <StatusBadge status={order.status} />
                <PaymentBadge status={order.paymentStatus} />
                <span className="min-w-[90px] text-right text-sm font-bold tabular-nums">{formatGhs(order.total)}</span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function AdminDashboard() {
  const token = useUi((s) => s.adminToken) ?? "";
  const setAdminToken = useUi((s) => s.setAdminToken);
  const { data, isLoading, isError, refetch, isFetching } = useAdminOrders();
  const { data: info } = useStoreInfo();
  const year = info?.shilohYear ?? STORE_INFO_DEFAULTS.shilohYear;
  const [section, setSection] = useState<BackOfficePage>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);

  // The Back Office has its own address and supports direct links, refresh,
  // and browser Back/Forward without leaking anything into the storefront URL.
  useEffect(() => {
    setSection(pageFromUrl());
    const syncFromHistory = () => setSection(pageFromUrl());
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [sidebarOpen]);

  const navigate = (next: BackOfficePage) => {
    setSection(next);
    setSidebarOpen(false);
    if (window.location.pathname === "/backoffice") {
      const url = new URL(window.location.href);
      if (next === "overview") url.searchParams.delete("section");
      else url.searchParams.set("section", next);
      window.history.pushState(null, "", url.pathname + url.search);
    }
    window.scrollTo(0, 0);
  };

  const runPrint = (job: PrintJob) => {
    setPrintJob(job);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => window.print())
    );
  };

  useEffect(() => {
    if (!printJob) return;
    const clear = () => setPrintJob(null);
    window.addEventListener("afterprint", clear);
    const t = setTimeout(clear, 60_000);
    return () => {
      window.removeEventListener("afterprint", clear);
      clearTimeout(t);
    };
  }, [printJob]);

  const activePage = PAGE_DETAILS.find((page) => page.id === section) ?? PAGE_DETAILS[0];
  const PageIcon = activePage.icon;

  const signOut = async () => {
    try { await fetch("/api/admin/session", { method: "DELETE" }); }
    finally { setAdminToken(null); }
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="print-hidden-app min-h-dvh lg:flex">
        {sidebarOpen ? (
          <button
            type="button"
            aria-label="Close Back Office navigation"
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside
          id="backoffice-sidebar"
          aria-label="Back Office navigation"
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex h-dvh w-[276px] shrink-0 flex-col border-r border-border bg-card shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0 lg:shadow-none",
            !sidebarOpen && "-translate-x-full",
            sidebarCollapsed && "lg:w-[76px]"
          )}
        >
          <div className={cn("flex h-[74px] shrink-0 items-center gap-3 border-b border-border px-5", sidebarCollapsed && "lg:justify-center lg:px-2")}>
            <BrandLogo size={38} />
            <div className={cn("min-w-0", sidebarCollapsed && "lg:hidden")}>
              <p className="font-display text-sm font-bold tracking-wide">Shiloh {year}</p>
              <p className="mt-1 text-[0.66rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Store management</p>
            </div>
            <button
              type="button"
              className="ml-auto flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <nav className="pretty-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label="Main navigation">
            {BACKOFFICE_GROUPS.map((group) => (
              <div key={group.label}>
                <p className={cn("mb-2 px-3 text-[0.63rem] font-bold tracking-[0.2em] text-muted-foreground/80", sidebarCollapsed && "lg:sr-only")}>
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map(({ id, label, icon: Icon }) => {
                    const selected = section === id;
                    return (
                      <button
                        type="button"
                        key={id}
                        title={label}
                        aria-current={selected ? "page" : undefined}
                        onClick={() => navigate(id)}
                        className={cn(
                          "group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold",
                          selected
                            ? "border border-gold/25 bg-gold/12 text-gold"
                            : "border border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
                          sidebarCollapsed && "lg:justify-center lg:px-2"
                        )}
                      >
                        <Icon className="size-[19px] shrink-0" aria-hidden />
                        <span className={cn("min-w-0 flex-1 truncate", sidebarCollapsed && "lg:hidden")}>{label}</span>
                        {selected ? <span className={cn("size-1.5 rounded-full bg-gold", sidebarCollapsed && "lg:hidden")} aria-hidden /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="shrink-0 border-t border-border p-3">
            <a
              href="/"
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                sidebarCollapsed && "lg:justify-center lg:px-2"
              )}
              title="View storefront"
            >
              <ExternalLink className="size-[19px] shrink-0" aria-hidden />
              <span className={cn(sidebarCollapsed && "lg:hidden")}>View storefront</span>
            </a>
            <button
              type="button"
              onClick={signOut}
              title="Sign out"
              className={cn(
                "mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
                sidebarCollapsed && "lg:justify-center lg:px-2"
              )}
            >
              <LogOut className="size-[19px] shrink-0" aria-hidden />
              <span className={cn(sidebarCollapsed && "lg:hidden")}>Sign out</span>
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-lg sm:px-7">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open Back Office navigation"
                aria-controls="backoffice-sidebar"
                aria-expanded={sidebarOpen}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-secondary lg:hidden"
              >
                <Menu className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setSidebarCollapsed((v) => !v)}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden size-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-secondary lg:flex"
              >
                {sidebarCollapsed ? <PanelLeftOpen className="size-5" aria-hidden /> : <PanelLeftClose className="size-5" aria-hidden />}
              </button>
              <span className="hidden text-xs text-muted-foreground sm:block">Back Office</span>
              <ChevronRight className="hidden size-3.5 text-muted-foreground sm:block" aria-hidden />
              <span className="truncate text-sm font-semibold">{activePage.label}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => refetch()}
                title="Refresh orders"
                aria-label="Refresh order data"
                className="flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <RefreshCcw className={cn("size-4", isFetching && "animate-spin")} aria-hidden />
              </button>
              <a
                href="/"
                className="hidden h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground hover:border-gold/40 hover:text-gold sm:inline-flex"
              >
                <ExternalLink className="size-4" aria-hidden /> Store
              </a>
              <span className="flex size-9 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold" title="Administrator">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
            </div>
          </header>

          <main id="backoffice-main" className="mx-auto w-full max-w-[1550px] px-4 py-6 pb-16 sm:px-7 lg:py-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
                  <PageIcon className="size-5" aria-hidden />
                </div>
                <div>
                  <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{activePage.label}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{activePage.detail}</p>
                </div>
              </div>
              {section === "overview" ? (
                <Button type="button" size="sm" className="rounded-xl bg-gold font-semibold text-primary-foreground hover:bg-gold/90" onClick={() => navigate("orders")}>
                  <ShoppingBag className="mr-2 size-4" aria-hidden /> Manage orders
                </Button>
              ) : null}
            </div>

            {section === "overview" ? (
              <OverviewPanel data={data} loading={isLoading || (isError && !data)} error={isError} onRefresh={() => { void refetch(); }} onNavigate={navigate} paymentsActive={info?.hubtelActive ?? false} />
            ) : null}
            {section === "orders" ? (
              <OrdersPanel token={token} onPrintInvoice={(order) => runPrint({ kind: "invoice", order })} onPrintManifest={(orders) => runPrint({ kind: "manifest", orders })} />
            ) : null}
            {section === "insights" ? <AdminInsights orders={data?.orders?.filter((order) => !order.adminNotes?.startsWith("[LIVE_PAYMENT_QA]")) ?? null} loading={isLoading} /> : null}
            {section === "products" ? <AdminProducts token={token} /> : null}
            {section === "content" ? <AdminContent token={token} /> : null}
            {section === "alerts" ? <AdminAlerts token={token} /> : null}
            {section === "settings" ? <AdminSettings token={token} /> : null}
          </main>
        </div>
      </div>

      <div className="print-doc" aria-hidden>
        {printJob ? <PrintRoot job={printJob} year={year} /> : null}
      </div>
    </div>
  );
}
