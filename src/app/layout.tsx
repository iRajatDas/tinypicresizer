import { cn } from "@/lib/utils";
import "@/styles/globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SiteHeader from "@/components/site/header";
import SiteFooter from "@/components/site/footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Tiny Pic Resizer",
  description: "Resize your images to a target size, e.g. 100KB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={cn(
          "relative flex size-full min-h-screen flex-col bg-white overflow-x-hidden antialiased",
          inter.variable
        )}
      >
        <div className="flex h-full grow flex-col">
          <SiteHeader />
          <main className="flex-1 flex justify-center">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
