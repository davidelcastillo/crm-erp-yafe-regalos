"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { logout } from "@/actions/auth";

/**
 * Encabezado de página del rebranding: una sola fila en mobile (botón ☰, título
 * y lo que se pase a la derecha, típicamente el selector de sucursal).
 *
 * En mobile las **acciones de la página** van como tarjetas debajo del encabezado
 * (`ActionCard`) y el **cierre de sesión** vive dentro del menú ☰; desde desktop
 * las acciones y el cierre de sesión se muestran en la barra. El menú es
 * mobile-only (`md:hidden`): en PC no hay nada que esconder.
 */
export interface PageMenuItem {
  label: string;
  icon?: ReactNode;
  /** Fila de navegación (link real) o de acción: se pasa una de las dos. */
  href?: string;
  onClick?: () => void;
}

export interface PageHeaderProps {
  title: string;
  /** Acciones de la página: visibles en la barra desde desktop. */
  actions?: ReactNode;
  /** Contenido siempre visible a la derecha del título. */
  right?: ReactNode;
  /** Fila propia debajo del título: el lugar del selector de sucursal. */
  below?: ReactNode;
  /** Filas extra del menú ☰ (el cierre de sesión va siempre al final). */
  menuItems?: PageMenuItem[];
}

export const PageHeader = ({ title, actions, right, below, menuItems = [] }: PageHeaderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // Escape cierra el menú, igual que los modales.
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    router.push("/login");
  };

  const menuItemClass =
    "flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-[#222222] hover:bg-white/60 transition-colors touch-manipulation";

  return (
    <>
      <header className="px-3 pt-6">
        <div className="flex items-center gap-3 rounded-2xl glass-strong px-4 py-3">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={isOpen}
            className="md:hidden w-11 h-11 -ml-2 flex items-center justify-center rounded-xl text-[#222222] hover:bg-white/60 transition-colors touch-manipulation"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <h1 className="flex-1 text-2xl font-bold text-[#222222]">{title}</h1>

          {right}

          {actions && <div className="hidden md:flex items-center gap-2">{actions}</div>}

          <button
            type="button"
            onClick={handleLogout}
            className="hidden md:flex px-4 min-h-[44px] items-center text-sm font-medium text-[#3f3f3f] bg-white/60 rounded-xl hover:bg-white/80 transition-colors touch-manipulation"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Fila propia: en un celular chico el selector no entra junto al título. */}
        {below && <div className="mt-3">{below}</div>}
      </header>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={`Menú de ${title}`}
        >
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative w-64 h-full glass-strong border-r border-white/50 shadow-2xl flex flex-col pt-6 px-4 animate-fade-in-right">
            <div className="flex items-start justify-between mb-6">
              <h2 className="text-xl font-bold bg-clip-text text-transparent brand-gradient-strong">
                Seguimientos
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar menú"
                className="w-11 h-11 -mr-1 flex items-center justify-center rounded-full text-[#6a6a6a] hover:bg-white/60 transition-colors touch-manipulation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="flex flex-col gap-1">
              {menuItems.map((item) =>
                item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={menuItemClass}
                  >
                    {item.icon && (
                      <span className="text-[#6a6a6a]" aria-hidden="true">
                        {item.icon}
                      </span>
                    )}
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      item.onClick?.();
                    }}
                    className={menuItemClass}
                  >
                    {item.icon && (
                      <span className="text-[#6a6a6a]" aria-hidden="true">
                        {item.icon}
                      </span>
                    )}
                    {item.label}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-[#c13515] hover:bg-white/60 transition-colors touch-manipulation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Cerrar sesión
              </button>
            </nav>
          </div>
        </div>
      )}
    </>
  );
};
