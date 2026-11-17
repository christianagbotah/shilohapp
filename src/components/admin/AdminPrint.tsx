"use client";

import type { OrderDTO } from "@/lib/types";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/types";

export type PrintJob =
  | { kind: "invoice"; order: OrderDTO }
  | { kind: "manifest"; orders: OrderDTO[] };

const ghs = (n: number) =>
  `GH₵${n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function Letterhead({ year, subtitle }: { year: string; subtitle: string }) {
  return (
    <header style={{ borderBottom: "3px solid #b8860b", paddingBottom: 12, marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <p style={{ margin: 0, fontSize: 10, letterSpacing: 3, fontWeight: 700, color: "#57534e" }}>
            WINNERS CHAPEL INTERNATIONAL
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800, color: "#b8860b" }}>
            SHILOH {year} — OFFICIAL MERCH
          </p>
        </div>
        <div style={{ textAlign: "right", fontSize: 10, color: "#57534e", lineHeight: 1.5 }}>
          <p style={{ margin: 0, fontWeight: 700, color: "#111" }}>{subtitle}</p>
          <p style={{ margin: 0 }}>Printed {fmtDate(new Date().toISOString())}</p>
        </div>
      </div>
    </header>
  );
}

function StatusChip({ text, ok }: { text: string; ok?: "good" | "warn" | "bad" | "neutral" }) {
  const colors: Record<string, string> = {
    good: "#15803d",
    warn: "#b45309",
    bad: "#b91c1c",
    neutral: "#57534e",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        border: `1.5px solid ${colors[ok ?? "neutral"]}`,
        color: colors[ok ?? "neutral"],
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {text}
    </span>
  );
}

/** Single-order invoice — one A4 page. */
export function InvoiceDoc({ order, year }: { order: OrderDTO; year: string }) {
  const units = order.items.reduce((n, i) => n + i.quantity, 0);
  return (
    <div>
      <Letterhead year={year} subtitle={`ORDER INVOICE — ${order.code}`} />

      <section style={{ display: "flex", justifyContent: "space-between", gap: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 11, lineHeight: 1.7 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "#57534e" }}>
            BILL TO
          </p>
          <p style={{ margin: "6px 0 0", fontWeight: 700, fontSize: 13 }}>{order.fullName}</p>
          <p style={{ margin: 0 }}>{order.phone}</p>
          <p style={{ margin: 0, maxWidth: 260 }}>{order.address || "— no address provided —"}</p>
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.7, textAlign: "right" }}>
          <p style={{ margin: 0 }}>
            <strong>Order code:</strong> {order.code}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Placed:</strong> {fmtDate(order.createdAt)}
          </p>
          <p style={{ margin: "6px 0 0" }}>
            <StatusChip
              text={PAYMENT_STATUS_LABELS[order.paymentStatus]}
              ok={order.paymentStatus === "paid" ? "good" : order.paymentStatus === "verifying" ? "warn" : "neutral"}
            />{" "}
            <StatusChip
              text={ORDER_STATUS_LABELS[order.status]}
              ok={order.status === "fulfilled" ? "good" : order.status === "cancelled" ? "bad" : "warn"}
            />
          </p>
          <p style={{ margin: "6px 0 0" }}>
            {order.paymentMethod
              ? `Paid via ${PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}${order.paidAt ? ` — ${fmtDate(order.paidAt)}` : ""}`
              : "Payment method: not set (awaiting Hubtel payment)"}
          </p>
        </div>
      </section>

      <table>
        <thead>
          <tr>
            <th style={{ width: 24 }}>#</th>
            <th>Item</th>
            <th>Colour</th>
            <th>Size</th>
            <th>Style</th>
            <th style={{ textAlign: "center" }}>Qty</th>
            <th style={{ textAlign: "right" }}>Unit</th>
            <th style={{ textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, idx) => (
            <tr key={item.id}>
              <td>{idx + 1}</td>
              <td style={{ fontWeight: 600 }}>
                {item.productName}
                <span style={{ color: "#57534e" }}> · {item.ageGroup === "kid" ? "Kids" : "Adult"}</span>
              </td>
              <td>{item.color}</td>
              <td>{item.size}</td>
              <td>{item.capStyle ?? "—"}</td>
              <td style={{ textAlign: "center" }}>{item.quantity}</td>
              <td style={{ textAlign: "right" }}>{ghs(item.unitPrice)}</td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>{ghs(item.unitPrice * item.quantity)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={5} style={{ border: "none", textAlign: "right", fontWeight: 700 }}>
              Total ({units} unit{units === 1 ? "" : "s"})
            </td>
            <td colSpan={3} style={{ textAlign: "right", fontWeight: 800, fontSize: 13, color: "#b8860b" }}>
              {ghs(order.total)}
            </td>
          </tr>
        </tbody>
      </table>

      {order.adminNotes ? (
        <section style={{ marginTop: 16, fontSize: 11 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: "#57534e" }}>
            INTERNAL NOTES
          </p>
          <p style={{ margin: "4px 0 0" }}>{order.adminNotes}</p>
        </section>
      ) : null}

      <footer style={{ marginTop: 42, display: "flex", justifyContent: "space-between", gap: 32, fontSize: 10, color: "#57534e" }}>
        <div style={{ flex: 1 }}>
          <div style={{ borderTop: "1px solid #a8a29e", paddingTop: 4, width: 200 }}>Prepared by</div>
        </div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ borderTop: "1px solid #a8a29e", paddingTop: 4, width: 200, marginLeft: "auto" }}>
            Customer signature
          </div>
        </div>
      </footer>
      <p style={{ marginTop: 18, textAlign: "center", fontSize: 10, color: "#57534e" }}>
        Thank you for shopping Shiloh {year} official merch — track your order any time with code{" "}
        <strong>{order.code}</strong>.
      </p>
    </div>
  );
}

/** Multi-order fulfilment manifest. */
export function ManifestDoc({ orders, year }: { orders: OrderDTO[]; year: string }) {
  const totalUnits = orders.reduce((n, o) => n + o.items.reduce((m, i) => m + i.quantity, 0), 0);
  const totalValue = orders.reduce((n, o) => n + o.total, 0);
  const paidCount = orders.filter((o) => o.paymentStatus === "paid").length;

  return (
    <div>
      <Letterhead year={year} subtitle="ORDER MANIFEST" />

      <section style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        {[
          { label: "Orders", value: String(orders.length) },
          { label: "Units", value: String(totalUnits) },
          { label: "Paid", value: `${paidCount}/${orders.length}` },
          { label: "Total value", value: ghs(totalValue) },
        ].map((s) => (
          <div
            key={s.label}
            style={{ flex: 1, border: "1px solid #d6d3d1", borderRadius: 8, padding: "8px 10px" }}
          >
            <p style={{ margin: 0, fontSize: 9, letterSpacing: "0.1em", color: "#57534e", fontWeight: 700 }}>
              {s.label.toUpperCase()}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 800 }}>{s.value}</p>
          </div>
        ))}
      </section>

      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Placed</th>
            <th>Customer</th>
            <th>Phone</th>
            <th>Items</th>
            <th style={{ textAlign: "right" }}>Total</th>
            <th>Payment</th>
            <th>Status</th>
            <th>✓</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td style={{ fontWeight: 700 }}>{o.code}</td>
              <td>{new Date(o.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td>
              <td>{o.fullName}</td>
              <td>{o.phone}</td>
              <td>{o.items.reduce((n, i) => n + i.quantity, 0)}</td>
              <td style={{ textAlign: "right", fontWeight: 600 }}>{ghs(o.total)}</td>
              <td>
                {o.paymentStatus === "paid" ? "PAID" : o.paymentStatus === "verifying" ? "VERIFYING" : "UNPAID"}
              </td>
              <td>{ORDER_STATUS_LABELS[o.status]}</td>
              <td style={{ color: "#a8a29e" }}>☐</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 18, fontSize: 10, color: "#57534e", textAlign: "center" }}>
        Shiloh {year} Back Office — generated {fmtDate(new Date().toISOString())}
      </p>
    </div>
  );
}

export function PrintRoot({ job, year }: { job: PrintJob; year: string }) {
  if (job.kind === "invoice") return <InvoiceDoc order={job.order} year={year} />;
  return <ManifestDoc orders={job.orders} year={year} />;
}
