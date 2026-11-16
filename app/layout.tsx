import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

import { Header } from "@/components/header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Marketplace",
  description:
    "A small Facebook-style marketplace: post an item with a photo, browse by category, and message the seller. Built with Next.js, React 19, Supabase, Tailwind CSS and shadcn/ui.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Header />
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
