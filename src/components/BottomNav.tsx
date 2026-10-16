"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// Icon components (simple SVG icons)
const DashboardIcon = ({ active }: { active: boolean }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const PurchaseIcon = ({ active }: { active: boolean }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 014 0z" />
  </svg>
);

const SaleIcon = ({ active }: { active: boolean }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
);

const InventoryIcon = ({ active }: { active: boolean }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-2a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const ClientsIcon = ({ active }: { active: boolean }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

// Icon for Sucursales (simple building-like icon)
const SucursalIcon = ({ active }: { active: boolean }) => (
   <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 0M5 7l0 12M7 7l0 12M9 7l0 12M11 7l0 12M13 7l0 12M15 7l0 12M17 7l0 12" />
   </svg>
);

const navItems = [
   { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
   { href: "/compras", label: "Compras", icon: PurchaseIcon },
   { href: "/ventas", label: "Ventas", icon: SaleIcon },
   { href: "/inventario", label: "Inventario", icon: InventoryIcon },
   { href: "/sucursales", label: "Sucursales", icon: SucursalIcon },
   { href: "/clientes", label: "Clientes", icon: ClientsIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (
    pathname.startsWith("/sucursal/") ||
    pathname === "/login" ||
    pathname === "/unauthorized"
  ) {
    return null;
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-2xl border-t border-white/80 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-50">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
           {navItems.map((item) => {
             const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
             const Icon = item.icon;
             const linkClassName = `flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 ease-in-out ${isActive ? "text-[#ff385c]" : "text-[#6a6a6a] hover:text-[#3f3f3f]"}`;
             const spanClassName = `text-xs mt-1 font-medium ${isActive ? "text-[#ff385c]" : "text-[#6a6a6a]"}`;
             return (
               <Link key={item.href} href={item.href} className={linkClassName}>
                 <Icon active={isActive} />
                 <span className={spanClassName}>
                   {item.label}
                 </span>
               </Link>
             );
           })}
        </div>
      </nav>
    </>
  );
}