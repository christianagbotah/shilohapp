"use client";

import { useMemo } from "react";
import { BarChart3, CalendarDays, Loader2, Package, TrendingUp, Wallet } from "lucide-react";
import { formatGhs } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderDTO } from "@/lib/types";

/**
 * Sales insights computed client-side from the orders query the dashboard
 * already loads — no extra API round-trip.
 */

type DayBucket = {
  key: number; // midnight timestamp
  label: string; // "12 Dec"
  revenue: number;
  orders: number;
};

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  sub?: string;
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
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function AdminInsights({ orders, loading }: { orders: OrderDTO[] | null; loading: boolean }) {
  // ---- Last 14 days of paid revenue ----
  const days: DayBucket[] = useMemo(() => {
    const out: DayBucket[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      out.push({
        key: d.getTime(),
        label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        revenue: 0,
        orders: 0,
      });
    }
    if (!orders) return out;
    for (const o of orders) {
      if (o.paymentStatus !== "paid" || !o.paidAt) continue;
      const t = new Date(o.paidAt);
      t.setHours(0, 0, 0, 0);
      const slot = out.find((s) => s.key === t.getTime());
      if (slot) {
        slot.revenue += o.total;
        slot.orders += 1;
      }
    }
    return out;
  }, [orders]);

  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);
  const windowRevenue = days.reduce((n, d) => n + d.revenue, 0);
  const windowOrders = days.reduce((n, d) => n + d.orders, 0);
  const bestDay = days.reduce<DayBucket | null>(
    (best, d) => (d.revenue > 0 && (!best || d.revenue > best.revenue) ? d : best),
    null
  );

  // ---- Today snapshot (all orders placed today, paid today) ----
  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const placedToday = (orders ?? []).filter(
      (o) => new Date(o.createdAt).getTime() >= start.getTime()
    );
    const paidToday = (orders ?? []).filter(
      (o) => o.paidAt && new Date(o.paidAt).getTime() >= start.getTime()
    );
    return {
      ordersPlaced: placedToday.length,
      revenue: paidToday.reduce((n, o) => n + o.total, 0),
    };
  }, [orders]);

  // ---- Top products by units sold (paid orders only) ----
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; units: number; revenue: number }>();
    for (const o of orders ?? []) {
      if (o.paymentStatus !== "paid") continue;
      for (const it of o.items) {
        const cur = map.get(it.productName) ?? { name: it.productName, units: 0, revenue: 0 };
        cur.units += it.quantity;
        cur.revenue += it.unitPrice * it.quantity;
        map.set(it.productName, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.units - a.units).slice(0, 5);
  }, [orders]);

  const maxUnits = Math.max(...topProducts.map((p) => p.units), 1);

  // ---- Payment & fulfilment mix ----
  const mix = useMemo(() => {
    const list = orders ?? [];
    const paid = list.filter((o) => o.paymentStatus === "paid");
    return {
      paidCount: paid.length,
      hubtelPaid: paid.filter((o) => o.paymentMethod === "hubtel").length,
      manualPaid: paid.filter((o) => o.paymentMethod === "momo-manual").length,
      unpaid: list.filter((o) => o.paymentStatus !== "paid" && o.status !== "cancelled").length,
      fulfilled: list.filter((o) => o.status === "fulfilled").length,
      total: list.length,
    };
  }, [orders]);

  if (loading || !orders) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading insights…
      </div>
    );
  }

  const paidAllTime = orders.filter((o) => o.paymentStatus === "paid");
  const avgOrder = paidAllTime.length > 0
    ? paidAllTime.reduce((n, o) => n + o.total, 0) / paidAllTime.length
    : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Snapshot tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          icon={CalendarDays}
          label="Orders today"
          value={String(today.ordersPlaced)}
          sub={`${today.revenue > 0 ? formatGhs(today.revenue) : "GHS 0.00"} collected today`}
        />
        <Tile
          icon={TrendingUp}
          label="Revenue — 14 days"
          value={formatGhs(windowRevenue)}
          sub={`${windowOrders} paid order${windowOrders === 1 ? "" : "s"} in window`}
          highlight
        />
        <Tile
          icon={Wallet}
          label="Avg paid order"
          value={avgOrder > 0 ? formatGhs(avgOrder) : "–"}
          sub={`${paidAllTime.length} paid order${paidAllTime.length === 1 ? "" : "s"} all-time`}
        />
        <Tile
          icon={Package}
          label="Awaiting payment"
          value={String(mix.unpaid)}
          sub="Not yet paid, not cancelled"
        />
      </div>

      {/* 14-day revenue chart */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display text-base font-bold">
            <BarChart3 className="h-4.5 w-4.5 text-gold" aria-hidden />
            Paid revenue — last 14 days
          </h3>
          {bestDay ? (
            <p className="text-xs text-muted-foreground">
              Best day: <span className="font-semibold text-foreground">{bestDay.label}</span> —{" "}
              {formatGhs(bestDay.revenue)}
            </p>
          ) : null}
        </div>
        <div className="mt-4 flex h-44 items-end gap-1.5 sm:gap-2" role="img" aria-label="Bar chart of paid revenue for each of the last 14 days">
          {days.map((d) => {
            const pct = Math.round((d.revenue / maxRevenue) * 100);
            return (
              <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                <div
                  className={cn(
                    "w-full rounded-t-md",
                    d.revenue > 0
                      ? "bg-gradient-to-t from-gold-deep to-gold"
                      : "bg-secondary"
                  )}
                  style={{ height: `${Math.max(pct, d.revenue > 0 ? 6 : 3)}%` }}
                  title={`${d.label}: ${formatGhs(d.revenue)} from ${d.orders} order${d.orders === 1 ? "" : "s"}`}
                />
                <span className="w-full truncate text-center text-[0.58rem] leading-none text-muted-foreground">
                  {d.label.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[0.62rem] text-muted-foreground">
          <span>{days[0]?.label}</span>
          <span>Today</span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top products */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="font-display text-base font-bold">Top products</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Units from paid orders, all-time.
          </p>
          {topProducts.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No paid orders yet — top sellers appear here.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {topProducts.map((p, i) => (
                <li key={p.name} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-semibold">
                      {i + 1}. {p.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {p.units} unit{p.units === 1 ? "" : "s"} •{" "}
                      <span className="font-semibold text-gold">{formatGhs(p.revenue)}</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold to-gold-deep"
                      style={{ width: `${Math.max(Math.round((p.units / maxUnits) * 100), 6)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Payment & fulfilment mix */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h3 className="font-display text-base font-bold">Payment &amp; fulfilment</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How orders are settling, all-time.
          </p>
          <dl className="mt-4 space-y-2.5 text-sm">
            {[
              { label: "Paid via Hubtel checkout", value: mix.hubtelPaid, tone: "gold" },
              { label: "Paid manually (confirmed by team)", value: mix.manualPaid, tone: "gold" },
              { label: "Awaiting payment", value: mix.unpaid, tone: "muted" },
              { label: "Fulfilled orders", value: mix.fulfilled, tone: "emerald" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <dt className="min-w-0 truncate text-muted-foreground">{row.label}</dt>
                <dd
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-bold tabular-nums",
                    row.tone === "gold" && "bg-gold/15 text-gold",
                    row.tone === "emerald" && "bg-emerald-500/15 text-emerald-400",
                    row.tone === "muted" && "bg-secondary text-muted-foreground"
                  )}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
            <div
              className="h-full bg-gradient-to-r from-gold to-gold-deep"
              style={{ width: mix.total > 0 ? `${(mix.paidCount / mix.total) * 100}%` : "0%" }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {mix.total > 0
              ? `${Math.round((mix.paidCount / mix.total) * 100)}% of all orders are paid`
              : "No orders yet."}
          </p>
        </section>
      </div>
    </div>
  );
}
