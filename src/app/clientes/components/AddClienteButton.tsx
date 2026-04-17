"use client";

import { createCustomer } from "@/app/actions/customer";
import Swal from "sweetalert2";

interface AddClienteButtonProps {
  onAdd: () => void;
}

export function AddClienteButton({ onAdd }: AddClienteButtonProps) {
  const handleAdd = async () => {
    const result = await Swal.fire({
      title: "Nuevo Cliente",
      html: `
        <input type="text" id="name" class="swal2-input" placeholder="Nombre">
        <input type="text" id="surname" class="swal2-input" placeholder="Apellido">
      `,
      preConfirm: () => {
        const name = (document.getElementById("name") as HTMLInputElement)?.value;
        const surname = (document.getElementById("surname") as HTMLInputElement)?.value;
        if (!name || !surname) {
          Swal.showValidationMessage("Complete todos los campos");
          return false;
        }
        return { name, surname };
      },
      confirmButtonText: "Crear Cliente",
      confirmButtonColor: "#22c55e",
      showCancelButton: true,
      cancelButtonText: "Cancelar",
      cancelButtonColor: "#6b7280",
    });

    if (result.isConfirmed && result.value) {
      try {
        const res = await createCustomer(result.value);
        if (res.success) {
          await Swal.fire({
            title: "¡Cliente creado!",
            text: `${result.value.name} ${result.value.surname} fue agregado`,
            icon: "success",
            confirmButtonColor: "#22c55e",
            timer: 1500,
            showConfirmButton: false,
          });
          onAdd();
        } else {
          await Swal.fire({
            title: "Error",
            text: res.error || "No se pudo crear el cliente",
            icon: "error",
            confirmButtonColor: "#ef4444",
          });
        }
      } catch (error) {
        console.error("Error creating customer:", error);
        await Swal.fire({
          title: "Error",
          text: "Error al crear el cliente",
          icon: "error",
          confirmButtonColor: "#ef4444",
        });
      }
    }
  };

  return (
    <button
      onClick={handleAdd}
      className="fixed bottom-24 right-6 w-14 h-14 bg-[#222222] rounded-full shadow-lg flex items-center justify-center hover:bg-[#333] transition-colors z-40"
      aria-label="Agregar cliente"
    >
      <svg
        className="w-6 h-6 text-white"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4v16m8-8H4"
        />
      </svg>
    </button>
  );
}