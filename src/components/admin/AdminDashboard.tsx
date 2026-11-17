"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Banknote,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
            {order.paymentStatus !== "paid" ? (
              <Button
                onClick={() => act("paid", { paymentStatus: "paid" })}
                disabled={busy !== null}
                className="rounded-full bg-emerald-500 font-semibold text-black hover:bg-emerald-400"
              >
                {busy === "paid" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
                )}
                Confirm payment received
              </Button>
            ) : (
              <Button
                onClick={() => act("unpaid", { paymentStatus: "unpaid" })}
                disabled={busy !== null}
                variant="outline"
                className="rounded-full border-border"
              >
                Revert to unpaid
              </Button>
            )}
            {order.paymentStatus === "verifying" ? (
              <Button
                onClick={() => act("unverified", { paymentStatus: "unpaid" })}
                disabled={busy !== null}
                variant="outline"
                className="rounded-full border-border text-muted-foreground"
              >
                Payment not seen yet
              </Button>
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
                  disabled={busy !== null}
                  onClick={() => act("fulfilled", { status: "fulfilled" })}
                  className="rounded-full bg-gradient-to-r from-gold to-gold-deep font-bold text-primary-foreground hover:opacity-95"
                >
                  Mark fulfilled
                </Button>
                <Button
                  variant="outline"
                  disabled={busy !== null}
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
    "Total (GHS)",
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

export function AdminDashboard() {
  const token = useUi((s) => s.adminToken) ?? "";
  const setAdminToken = useUi((s) => s.setAdminToken);
  const setView = useUi((s) => s.setView);
  const { data, isLoading } = useAdminOrders();
  const { data: info } = useStoreInfo();
  const year = info?.shilohYear ?? STORE_INFO_DEFAULTS.shilohYear;

  // ---- Printing (invoices & manifests) ----
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);

  const runPrint = (job: PrintJob) => {
    setPrintJob(job);
    // Give React a beat to render the hidden print document first.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.print();
      })
    );
  };

  useEffect(() => {
    if (!printJob) return;
    const clear = () => setPrintJob(null);
    window.addEventListener("afterprint", clear);
    // Fallback for browsers that don't fire afterprint reliably.
    const t = setTimeout(clear, 60_000);
    return () => {
      window.removeEventListener("afterprint", clear);
      clearTimeout(t);
    };
  }, [printJob]);

  return (
    <div className="min-h-dvh bg-background">
      <div className="print-hidden-app">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandLogo size={38} />
            <div className="leading-none">
              <p className="font-display text-base font-bold">Shiloh {year} — Back Office</p>
              <p className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Orders · Insights · Catalogue · Payments
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground"
              onClick={() => setView("store")}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Store</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-border"
              onClick={() => setAdminToken(null)}
            >
              <LogOut className="mr-1.5 h-4 w-4" aria-hidden />
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 pb-16 sm:px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard icon={ShoppingBag} label="Total orders" value={String(data?.stats.totalOrders ?? "–")} />
          <StatCard icon={Clock3} label="Pending review" value={String(data?.stats.pendingReview ?? "–")} />
          <StatCard
            icon={Wallet}
            label="Verifying payment"
            value={String(data?.stats.verifyingPayment ?? "–")}
            highlight
          />
          <StatCard
            icon={Banknote}
            label="Revenue collected"
            value={data ? formatGhs(data.stats.paidRevenue) : "–"}
            highlight
          />
          <StatCard icon={Package} label="Units sold" value={String(data?.stats.totalUnits ?? "–")} />
        </div>

        <Tabs defaultValue="orders" className="mt-8">
          <TabsList className="h-12 w-full justify-start gap-1 overflow-x-auto rounded-full bg-secondary p-1 no-scrollbar sm:w-auto">
            <TabsTrigger
              value="orders"
              className="rounded-full px-5 font-semibold data-[state=active]:bg-gold data-[state=active]:text-primary-foreground"
            >
              Orders
            </TabsTrigger>
            <TabsTrigger
              value="insights"
              className="rounded-full px-5 font-semibold data-[state=active]:bg-gold data-[state=active]:text-primary-foreground"
            >
              <BarChart3 className="mr-1.5 h-4 w-4" aria-hidden />
              Insights
            </TabsTrigger>
            <TabsTrigger
              value="products"
              className="rounded-full px-5 font-semibold data-[state=active]:bg-gold data-[state=active]:text-primary-foreground"
            >
              <Package className="mr-1.5 h-4 w-4" aria-hidden />
              Products
            </TabsTrigger>
            <TabsTrigger
              value="alerts"
              className="rounded-full px-5 font-semibold data-[state=active]:bg-gold data-[state=active]:text-primary-foreground"
            >
              <BellRing className="mr-1.5 h-4 w-4" aria-hidden />
              Alerts
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="rounded-full px-5 font-semibold data-[state=active]:bg-gold data-[state=active]:text-primary-foreground"
            >
              <Settings2 className="mr-1.5 h-4 w-4" aria-hidden />
              Settings
            </TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="mt-5">
            <OrdersPanel
              token={token}
              onPrintInvoice={(order) => runPrint({ kind: "invoice", order })}
              onPrintManifest={(orders) => runPrint({ kind: "manifest", orders })}
            />
          </TabsContent>
          <TabsContent value="insights" className="mt-5">
            <AdminInsights orders={data?.orders ?? null} loading={isLoading} />
          </TabsContent>
          <TabsContent value="products" className="mt-5">
            <AdminProducts token={token} />
          </TabsContent>
          <TabsContent value="alerts" className="mt-5">
            <AdminAlerts token={token} />
          </TabsContent>
          <TabsContent value="settings" className="mt-5">
            <AdminSettings token={token} />
          </TabsContent>
        </Tabs>
      </main>
      </div>

      {/* Hidden on screen — becomes the printable page via @media print */}
      <div className="print-doc" aria-hidden>
        {printJob ? <PrintRoot job={printJob} year={year} /> : null}
      </div>
    </div>
  );
}
