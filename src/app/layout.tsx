import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "../components/BottomNav";
import { BranchProviderWrapper } from "@/lib/context/BranchProviderWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Feria Conexx",
  description: "Control de ingresos, egresos e inventario para feria conexx",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // NOTE: no force-dynamic here — forcing it made EVERY route (including
  // /login) dynamic and re-run server-side work on each request. Route
  // segments that need freshness declare their own `dynamic` config.
  // Branch loading was also moved out of this server component: it now
  // happens client-side (or via the provider self-heal) so /login and
  // /unauthorized render without any Supabase/Prisma work.
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#ffffff]">
        <BranchProviderWrapper>
          <main className="flex-1">{children}</main>
          <BottomNav />
        </BranchProviderWrapper>
      </body>
    </html>
  );
}