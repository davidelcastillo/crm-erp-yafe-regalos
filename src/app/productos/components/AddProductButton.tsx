"use client";

import { useState } from "react";
import { ProductForm } from "./ProductForm";

export function AddProductButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-[#ff385c] text-white rounded-full shadow-lg hover:bg-[#e00b41] transition-colors flex items-center justify-center z-40"
        aria-label="Agregar producto"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
      {isOpen && <ProductForm product={null} onClose={() => setIsOpen(false)} />}
    </>
  );
}