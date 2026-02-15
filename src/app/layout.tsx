import type { Metadata } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Waqtu — Prayer times for your day",
  description:
    "Gentle prayer reminders and calendar protection for Mac. Know when to pray, block time in your calendar, and stay consistent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable} scroll-smooth`}>
      <body className="min-h-screen font-sans antialiased grain">
        {children}
      </body>
    </html>
  );
}
