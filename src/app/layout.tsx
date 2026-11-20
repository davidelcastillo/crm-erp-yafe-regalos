import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { fraunces, workSans } from "./fonts";
import "./globals.css";
import BottomNav from "../components/BottomNav";
import { BranchProviderWrapper } from "@/lib/context/BranchProviderWrapper";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Polkalina's Sistema Web",
  description: "Control de ingresos, egresos e inventario para Polkalina's",
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
      /* El script de arranque escribe `data-theme` antes de que React hidrate:
         sin esto, React avisa que el atributo del servidor no coincide. */
      suppressHydrationWarning
      className={`${workSans.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* El tema se aplica antes del primer pintado: leerlo desde un efecto de React
          mostraría la página en claro y después saltaría a oscuro. */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-surface">
        <BranchProviderWrapper>
          <main className="flex-1">{children}</main>
          <BottomNav />
        </BranchProviderWrapper>
      </body>
    </html>
  );
}