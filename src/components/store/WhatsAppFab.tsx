"use client";

import { MessageCircle } from "lucide-react";
import { useStoreInfo } from "@/hooks/use-store-data";

/**
 * Floating WhatsApp support button (bottom-left, mirroring the cart FAB on
 * the bottom-right). Shown only when the team phone (admin_phone setting)
 * is configured — the number doubles as the click-to-chat contact.
 */
export function WhatsAppFab() {
  const { data: info } = useStoreInfo();
  const phone = info?.supportPhone ?? "";
  if (!phone) return null;

  const href = `https://wa.me/${phone}?text=${encodeURIComponent(
    "Hello Shiloh team! I have a question about the Shiloh order website."
  )}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with the Shiloh team on WhatsApp"
      title="Chat with us on WhatsApp"
      className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl transition-transform hover:scale-105 hover:bg-[#1EBE5B] active:scale-95 sm:bottom-6 sm:left-6"
    >
      <MessageCircle className="h-6.5 w-6.5" aria-hidden />
    </a>
  );
}
