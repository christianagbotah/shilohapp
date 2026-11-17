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
  try {
    const [y, t] = await Promise.all([getSetting("shiloh_year"), getSetting("shiloh_tagline")]);
    if (y) year = y;
    if (t) tagline = t;
  } catch {
    // DB not initialised yet — keep defaults
  }
  return {
    title: `Shiloh ${year} (${tagline}) Merch — Official Convocation Store | Winners Chapel International`,
    description: `Official Shiloh ${year} “${tagline}” convocation merchandise for the Winners' family worldwide. T-shirts, lacostes, jerseys and caps for adults & kids. Order in seconds and pay with MTN Mobile Money across Ghana.`,
    keywords: [
      `Shiloh ${year}`,
      "Winners Chapel",
      "convocation merch",
      "Shiloh t-shirt",
      "Shiloh jersey",
      "Shiloh lacoste",
      "Shiloh cap",
      "Ghana mobile money shopping",
    ],
    openGraph: {
      title: `Shiloh ${year} Merch — Official Convocation Store`,
      description:
        "T-shirts, lacostes, jerseys & caps for adults and kids. Order in seconds, pay with MoMo anywhere in Ghana.",
      type: "website",
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
