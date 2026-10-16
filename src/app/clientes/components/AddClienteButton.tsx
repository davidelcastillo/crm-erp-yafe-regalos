"use client";

import { createCustomer } from "@/app/actions/customer";
import Swal from "sweetalert2";

interface AddClienteButtonProps {
  /** Opcional: si no se pasa, refresca la página al terminar. */
  onAdd?: () => void;
}

export function AddClienteButton({ onAdd }: AddClienteButtonProps) {
  // Estilos comunes de los diálogos: esquinas bien redondeadas y los botones con
  // las clases del sistema.`buttonsStyling: false` apaga el estilo propio de Swal,
  // que si no pisa los colores de marca.
  const estiloSwal = {
    width: 'min(92vw, 22rem)',
    background: '#ffffff',
    color: '#222222',
    buttonsStyling: false,
    customClass: {
      popup: 'rounded-3xl',
      confirmButton: 'btn btn-primary',
      cancelButton: 'btn btn-secondary',
    },
    confirmButtonColor: undefined,
    cancelButtonColor: undefined,
  };

  const estiloError = {
    ...estiloSwal,
    customClass: {
      ...estiloSwal.customClass,
      confirmButton: 'btn btn-danger',
    },
  };

  const handleAdd = async () => {
    const result = await Swal.fire({
      ...estiloSwal,
      title: "Nuevo Cliente",
      // Inputs propios (16px para que iOS no haga zoom al enfocar, 44px de alto).
      html: `
        <input type="text" id="name" placeholder="Nombre"
          style="width:100%;min-height:44px;border-radius:1rem;background:#f8f8f8;border:1px solid #e5e5e5;padding:0.75rem;font-size:16px;color:#222222;" />
        <input type="text" id="surname" placeholder="Apellido"
          style="width:100%;min-height:44px;margin-top:0.75rem;border-radius:1rem;background:#f8f8f8;border:1px solid #e5e5e5;padding:0.75rem;font-size:16px;color:#222222;" />
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
      showCancelButton: true,
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed && result.value) {
      try {
        const res = await createCustomer(result.value);
        if (res.success) {
          await Swal.fire({
            ...estiloSwal,
            title: "¡Cliente creado!",
            text: `${result.value.name} ${result.value.surname} fue agregado`,
            icon: "success",
            timer: 1500,
            showConfirmButton: false,
          });
          if (onAdd) onAdd();
          else window.location.reload();
        } else {
          await Swal.fire({
            ...estiloError,
            title: "Error",
            text: res.error || "No se pudo crear el cliente",
            icon: "error",
          });
        }
      } catch (error) {
        console.error("Error creating customer:", error);
        await Swal.fire({
          ...estiloError,
          title: "Error",
          text: "Error al crear el cliente",
          icon: "error",
        });
      }
    }
  };

  return (
    <button
      onClick={handleAdd}
      className="btn-fab fixed bottom-24 right-6 z-40"
      aria-label="Agregar cliente"
    >
      <svg
        className="w-6 h-6 text-gray-800"
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