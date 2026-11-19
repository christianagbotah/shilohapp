import type { Metadata } from "next";
import { BackOfficeClient } from "@/components/admin/BackOfficeClient";

export const metadata: Metadata = {
  title: "Shiloh Store — Back Office",
  robots: { index: false, follow: false, nocache: true },
};

export default function BackOfficePage() {
  return <BackOfficeClient />;
}
