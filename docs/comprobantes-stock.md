# Comprobantes PDF de movimientos de stock

Desde **Inventario** podés descargar un comprobante después de confirmar **Mover Stock** o **Entrada / Salida**. No es un comprobante fiscal ni una operación de dinero.

## Uso

1. Seleccioná sucursal, productos y cantidades como antes. En entrada/salida podés escribir el motivo.
2. Confirmá la operación. Solo si se registra correctamente aparece el resultado con **Descargar comprobante**.
3. Tocá el botón para generar y descargar el PDF. **No vuelve a registrar el movimiento**.
4. Cerrá el comprobante para volver al inventario. Guardá el PDF antes de cerrar: en esta versión no hay reimpresión histórica ni almacenamiento del archivo.

## Contenido

El diseño sigue el PDF de inventario: logo, banda con acento rosa, filas alternadas, totales y número de página.

- Encabezado: **Ingreso**, **Egreso** o **Movimiento de sucursal**; fecha y hora de Argentina; sucursal con su código. En traslados, origen y destino.
- Motivo: texto registrado por el usuario en entrada/salida; si no escribió uno, el rótulo existente `ENTRADA`/`SALIDA`. En traslados, referencia `MOVE-…` de la operación.
- Tabla: **Código | Nombre | Cantidad | Stock final | Precio unit.**
- **Cantidad**: unidades ingresadas, retiradas o trasladadas, no el stock total. En **Ingreso** el número lleva signo `+` en verde y en **Egreso** signo `-` en rojo; en **Movimiento de sucursal** va sin signo, porque la misma cantidad sale de una sucursal y entra en la otra. Las demás columnas usan el color de texto habitual.
- **Stock final**: saldo confirmado de esa sucursal; en traslados, **solo el destino**. Es el saldo de esa operación, no una consulta al stock que haya después de otros movimientos.
- **Precio unit.**: precio de venta del producto al registrar la operación, en ARS; no costo ni importe total del movimiento.
- Totales: cantidad de productos y suma de unidades movidas. Paginación automática; un nombre demasiado largo se abrevia con puntos suspensivos. El motivo se distribuye en líneas sin recortarlo. Helvetica no incluye emojis: los caracteres no representables se muestran como `?`.

## Fallos y límites

El snapshot se arma en la transacción que registra el movimiento; no se cambia el esquema ni se calculan saldos a partir de la pantalla. El PDF se genera en el navegador con carga diferida de `pdf-lib`, sin un endpoint de escritura adicional.

Si falla el PDF, el mensaje aclara **«El movimiento ya se registró»** y permite reintentar la descarga. **No repitas la operación de stock** para conseguir el documento. Un movimiento rechazado no debe ofrecer un comprobante exitoso.

Estos documentos no reemplazan el historial de movimientos. La publicación del catálogo externo y la descarga administrativa de comprobantes son recorridos separados.

## Verificación manual pendiente

- [ ] Catálogo externo: buscar por código/nombre en móvil y escritorio; agotados y productos exclusivos de otra sucursal no aparecen.
- [ ] Registrar ingreso, egreso y traslado en base local; aparece el botón sin una descarga automática.
- [ ] Abrir cada PDF: logo, motivo, sucursales, código, cantidades, precio y saldo correctos.
- [ ] PDF con varias páginas: encabezados y pies legibles, sin cortes de filas ni superposición de textos.
- [ ] Descargar otra vez no modifica el stock ni agrega movimientos.
- [ ] Si falla la descarga, el resultado conserva la operación exitosa y permite reintentar solo el PDF.
