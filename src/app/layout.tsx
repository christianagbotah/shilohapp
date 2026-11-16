import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shiloh 2026 Merch — Official Convocation Store | Winners Chapel International",
  description:
    "Official Shiloh 2026 convocation merchandise for the Winners' family worldwide. T-shirts, lacostes, jerseys and caps for adults & kids. Order in seconds and pay with MTN Mobile Money across Ghana.",
  keywords: [
    "Shiloh 2026",
    "Winners Chapel",
    "convocation merch",
    "Shiloh t-shirt",
    "Shiloh jersey",
    "Shiloh lacoste",
    "Shiloh cap",
    "Ghana mobile money shopping",
  ],
  openGraph: {
    title: "Shiloh 2026 Merch — Official Convocation Store",
    description:
      "T-shirts, lacostes, jerseys & caps for adults and kids. Order in seconds, pay with MoMo anywhere in Ghana.",
    type: "website",
  },
};

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
