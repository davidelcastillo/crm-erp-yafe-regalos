/**
 * Contacto de la vidriera (L4 de `odd/tasks/fotos-vidriera-polkalinas.md`): el
 * número del dueño es un dato público de la marca, no un secreto.
 *
 * Vive acá y no en la action porque un módulo `"use server"` solo puede exportar
 * funciones async; la ficha arma el link con esta misma función.
 */
export const WHATSAPP_VIDRIERA = "5493876360163";

/** Link de consulta con el nombre y el código del ítem ya en el mensaje. */
export const linkConsulta = (nombre: string, codigo: string) =>
  `https://wa.me/${WHATSAPP_VIDRIERA}?text=${encodeURIComponent(
    `Hola! Consulto por ${nombre} (${codigo})`
  )}`;
