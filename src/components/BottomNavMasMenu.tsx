"use client";

import Link from "next/link";
import { useState } from "react";

const MasMenuItem = ({ label, href, active }: { label: string; href: string; active: boolean }) => (
  <Link
    href={href}
    className={`
      flex w-full items-center justify-start px-4 py-3 text-sm font-medium
      transition-colors duration-150
      ${active ? "bg-gradient-to-r from-blue-200 to-pink-400 text-gray-800" : "text-[#6a6a6a] hover:bg-[#f2f2f2]"}
    `}
  >
    <span className="flex-1">{label}</span>
  </Link>
);

interface BottomNavMasMenuProps {
  items: Array<{ label: string; href: string }>;
  onClose: () => void;
}

export default function BottomNavMasMenu({ items, onClose }: BottomNavMasMenuProps) {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur z-40"
        onClick={onClose}
      />
      {/* Menu */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="bg-white border-t border-gray-200 shadow-xl max-w-lg mx-auto">
          <div className="space-y-1">
            {items.map((item, index) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <MasMenuItem
                  key={index}
                  label={item.label}
                  href={item.href}
                  active={active}
                />
              );
            })}
          </div>
          {/* Close button (tap outside also closes) */}
          <div className="flex items-center justify-center py-3">
            <button
              onClick={onClose}
              className="text-xs text-[#6a6a6a] hover:text-[#3f3f3f]"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}