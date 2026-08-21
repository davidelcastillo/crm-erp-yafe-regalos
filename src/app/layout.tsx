import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "../components/BottomNav";
import Navbar from "../components/Navbar";
import { BranchProviderWrapper } from "@/lib/context/BranchProviderWrapper";
import { getBranchOptions } from "@/app/actions/branch";

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

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch initial branches server-side to hydrate the BranchContext.
  // If the call fails (e.g., during build), fall back to empty list.
  const branchesResult = await getBranchOptions();
  const initialBranches = branchesResult.success && branchesResult.data
    ? branchesResult.data
    : [];

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#ffffff]">
        <BranchProviderWrapper initialBranches={initialBranches}>
          <Navbar />
          <main className="flex-1 pb-20 mt-5">{children}</main>
          <BottomNav />
        </BranchProviderWrapper>
      </body>
    </html>
  );
}