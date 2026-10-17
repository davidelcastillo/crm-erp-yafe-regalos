Jarvis, detengamos las máquinas un momento. Tenemos una falla de transmisión de datos en el frontend. El input del modal de pagos (cuyo ID es paymentAmount) no está enviando su valor; el sistema sigue diciendo 'ingrese un valor' a pesar de que el usuario lo tipea correctamente.

Necesito que audites e implementes lo siguiente en el componente del formulario de pago:

Inspección del Atributo name (Crítico): Si estás usando FormData nativo para enviar el Server Action, verifica que el <input> tenga el atributo name exacto que tu esquema Zod está esperando. Si Zod espera amount, el input debe ser <input id="paymentAmount" name="amount" ... />. Si falta el name, el valor jamás llegará al servidor.

Inspección del Estado Controlado (React State): Si estás usando un estado de React (useState) y una función manejadora (onSubmit con e.preventDefault()), asegúrate de que el input tenga el enlace correcto:
value={amount} y onChange={(e) => setAmount(e.target.value)}. Revisa que no haya errores tipográficos en el evento onChange que impidan que el estado se actualice.

Rastreo de Datos (Logs): > \* Agrega un console.log("Estado actual del input:", amount) en el cliente justo al hacer clic en el botón de pagar.

Agrega un console.log("Datos del FormData:", Object.fromEntries(formData.entries())) justo antes de enviar la petición.

Resolución: Aplica la corrección necesaria asegurándote de que el valor viaje como número al Server Action. No des por terminado este hotfix hasta que el flujo de datos desde el teclado del usuario hasta el console.log del servidor sea impecable.
