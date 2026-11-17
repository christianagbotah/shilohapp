"use client";

import { QueryProvider } from "@/components/providers/QueryProvider";
import { useUi } from "@/store/ui";
import { Header } from "@/components/store/Header";
import { Hero } from "@/components/store/Hero";
import { Marquee } from "@/components/store/Marquee";
import { OutfitCarousel } from "@/components/store/OutfitCarousel";
import { ShopSection } from "@/components/store/ShopSection";
import { HowItWorks } from "@/components/store/HowItWorks";
import { PaymentSection } from "@/components/store/PaymentSection";
import { FaqSection } from "@/components/store/FaqSection";
import { CtaBand } from "@/components/store/CtaBand";
import { Footer } from "@/components/store/Footer";
import { CartDrawer, CartFab } from "@/components/store/CartDrawer";
import { ProductSheet } from "@/components/store/ProductSheet";
import { CheckoutDialog } from "@/components/store/CheckoutDialog";
import { OrderSuccessDialog } from "@/components/store/OrderSuccessDialog";
import { PaymentResultDialog } from "@/components/store/PaymentResultDialog";
import { TrackOrderDialog } from "@/components/store/TrackOrderDialog";
import { AdminView } from "@/components/admin/AdminView";

function Storefront() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Marquee />
        <OutfitCarousel />
        <ShopSection />
        <HowItWorks />
        <PaymentSection />
        <FaqSection />
        <CtaBand />
      </main>
      <Footer />
      <CartDrawer />
      <ProductSheet />
      <CheckoutDialog />
      <OrderSuccessDialog />
      <PaymentResultDialog />
      <TrackOrderDialog />
      <CartFab />
    </div>
  );
}

export default function Page() {
  const view = useUi((s) => s.view);
  return (
    <QueryProvider>
      {view === "admin" ? <AdminView /> : <Storefront />}
    </QueryProvider>
  );
}
