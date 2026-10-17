Jarvis, tenemos que aplicar un parche de nivel profundo (Hotfix 7.3). El error de los decimales mutó y la validación de pagos sigue bloqueada.

Por favor, aplica estrictamente estas dos soluciones:

Serialización Profunda (Deep Serialization) en getCustomerHistory:

El error muestra que los objetos Decimal están anidados dentro de los items de cada sale.

Solución Obligatoria: En tu función getCustomerHistory, antes de retornar el objeto customer al cliente, debes mapear profundamente el resultado. No basta con parsear la venta; debes iterar sobre customer.sales, y dentro de cada venta, iterar sobre sale.items para convertir explícitamente price y subtotal a Number.

Ejemplo conceptual: > ```typescript
const serializedSales = customer.sales.map(sale => ({
...sale,
totalAmount: Number(sale.totalAmount),
amountPaid: Number(sale.amountPaid),
pendingBalance: Number(sale.pendingBalance),
items: sale.items.map(item => ({
...item,
price: Number(item.price),
subtotal: Number(item.subtotal)
}))
}));

Solución Definitiva al Bug de Pagos ('Mayor a 0'):

El componente Cliente está enviando el valor incorrectamente al Server Action.

Solución en el Cliente: En el modal de pago (Client Component), asegúrate de que el estado que guarda el monto esté inicializado correctamente (ej. const [amount, setAmount] = useState<number | string>("")). Antes de llamar al Server Action, convierte el valor: const amountAsNumber = Number(amount).

Validación de Seguridad: Añade un if (!amountAsNumber || amountAsNumber <= 0) { return alert('Ingrese un monto válido'); } en el componente cliente antes de enviar la petición al servidor, para bloquearlo en el frontend.

Solución en el Action: En el Server Action, haz un console.log("Monto recibido:", data.amount) justo antes de que Zod lo valide, para garantizar que está llegando el 2500 y no un string vacío, nulo o un objeto FormData sin parsear
