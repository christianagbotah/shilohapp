import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { getSetting } from "@/lib/store-utils";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  // Year + tagline come from the Back Office settings so they can be updated every year.
  let year = "2026";
  let tagline = "Far Above";
  let siteUrl = "";
  try {
    const [y, t, u] = await Promise.all([
      getSetting("shiloh_year"),
      getSetting("shiloh_tagline"),
      getSetting("site_url"),
    ]);
    if (y) year = y;
    if (t) tagline = t;
    if (u) siteUrl = u;
  } catch {
    // DB not initialised yet — keep defaults
  }
  // Absolute OG image URLs are required by WhatsApp / Facebook / X crawlers.
  const metadataBase = siteUrl
    ? new URL(siteUrl)
    : new URL("http://localhost:3000");
  return {
    metadataBase,
    title: `Shiloh ${year} — ${tagline} | Official Shiloh Orders | Winners Chapel International`,
    description: `Official Shiloh ${year} “${tagline}” convocation clothing and accessories for the Winners' family worldwide. T-shirts, lacostes, jerseys and caps for adults & kids. Order in seconds and pay with MTN Mobile Money across Ghana.`,
    keywords: [
      `Shiloh ${year}`,
      `Shiloh ${year} ${tagline}`,
      "Winners Chapel",
      "Shiloh 2026 products",
      "Shiloh t-shirt",
      "Shiloh jersey",
      "Shiloh lacoste",
      "Shiloh cap",
      "Ghana mobile money shopping",
    ],
    openGraph: {
      title: `Shiloh ${year} — ${tagline}`,
      description:
        "T-shirts, lacostes, jerseys & caps for adults and kids. Order in seconds and pay securely with MoMo or card via Hubtel, anywhere in Ghana.",
      type: "website",
      images: [
        {
          url: "/og-shiloh.jpg",
          width: 1344,
          height: 768,
          alt: `Shiloh ${year} “${tagline}” — Shiloh collection: tees, lacostes, jerseys & caps`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `Shiloh ${year} — ${tagline}`,
      description:
        "Official Shiloh collection — tees, lacostes, jerseys & caps. Pay securely with MoMo or card via Hubtel.",
      images: ["/og-shiloh.jpg"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#16121d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
