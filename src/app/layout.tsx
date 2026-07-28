import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import Script from "next/script";
import { JsonLd } from "@/components/json-ld";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const siteUrl = "https://getwaqtu.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Waqtu — Prayer Times in Your Menu Bar for Mac",
  description:
    "Prayer times in your Mac menu bar. Waqtu blocks your calendar during salah and shows you as busy in Teams and Slack. No ads, no tracking. macOS 12+.",
  keywords: [
    "prayer times mac",
    "mac menu bar prayer times",
    "best prayer times app mac",
    "prayer times app mac",
    "prayer times app macos",
    "mac os prayer times",
    "islamic prayer app mac",
    "salah reminder mac",
    "salah reminder macos",
    "menu bar prayer times mac",
    "muslim productivity app",
    "prayer times calendar block",
    "calendar prayer blocks",
    "teams busy prayer",
    "slack status prayer",
    "waqtu",
  ],
  authors: [{ name: "Waqtu" }],
  creator: "Waqtu",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Waqtu",
    title: "Waqtu — Prayer Times in Your Menu Bar for Mac",
    description:
      "Prayer times in your Mac menu bar. Calendar blocks during prayers. Teams shows you as busy. Made for Muslim professionals.",
    images: [
      {
        url: `${siteUrl}/og-image.webp`,
        width: 1200,
        height: 630,
        alt: "Waqtu — Prayer times in your Mac menu bar",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Waqtu — Prayer Times in Your Menu Bar for Mac",
    description:
      "Prayer times in your Mac menu bar. Calendar blocks during prayers. Teams shows you as busy.",
    images: [`${siteUrl}/og-image.webp`],
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${outfit.variable} scroll-smooth`}
    >
      <body className="min-h-screen font-sans antialiased">
        <JsonLd />
        <Script
          defer
          src="https://assets.onedollarstats.com/stonks.js"
          strategy="afterInteractive"
        />
        {children}
      </body>
    </html>
  );
}
