# Resolver bugs con alcance claro y ODD

Primero aclaramos cada bug; después lo reproducimos y corregimos. Recibir una lista no autoriza a implementar todos los ítems juntos ni a ampliar su alcance.

## Recorrido por bug

1. **Ubicar el caso.** Leer el módulo, sus consumidores y tests; identificar qué información ya está disponible.
2. **Preguntar lo que falta.** Pedir pasos reproducibles, resultado actual y esperado, entorno/rol/sucursal o límites del cambio solo cuando no estén claros. Si hay alternativas de producto, explicar la recomendación y esperar la elección.
3. **Acordar el alcance.** Dejar explícitos el caso que se corrige, sus efectos observables y qué queda afuera. No empezar a escribir una solución con una decisión de producto abierta.
4. **Reproducir.** Ejecutar el caso en estado aislado cuando pueda modificar datos. Si no se reproduce, pedir el ejemplo, captura o dato concreto que falta; no declarar que el usuario se equivoca porque el código parece correcto.
5. **Implementar con ODD.** Para un cambio pequeño y entendido, trabajar inline; si necesita continuidad, abrir `odd/tasks/<bug>.md` con Specs, Tasks y Log, y espejo completo en Engram (`project: "seguimientos-compras"`, topic `odd/<bug>/tasks`). No reabrir SDD.
6. **Verificar y cerrar.** Para comportamiento determinista, observar RED → GREEN y comprobar el comportamiento previo que comparte código. Registrar resultado, limitaciones, riesgo y commit autorizado antes de pasar al siguiente bug.

Las preguntas se adaptan al caso: no hay un número obligatorio ni rondas artificiales. Una respuesta puede resolver varias dudas; no volver a pedirla. Si se descubre una regla o funcionalidad nueva, separarla de la corrección y aclarar su autorización.

## Ficha breve para traer un bug

```text
Título:
Pantalla o recorrido:
Entorno, rol y sucursal (si aplica):
Pasos y datos de ejemplo sin secretos:
Qué ocurre (mensaje exacto si existe):
Qué esperabas:
Frecuencia y evidencia (captura/log sin credenciales):
Límites: qué no debería cambiar:
```

No hace falta completar todo para empezar: el agente pregunta únicamente por los huecos relevantes.

## Criterio de cierre

- El caso acordado tiene evidencia de reproducción y de corrección, o una limitación explícita que necesita decisión.
- Los checks aplicables se ejecutaron contra el entorno permitido; no se deduce cobertura de navegador o integración de tests con mocks.
- Los tests comprueban los efectos de la regla: resultado, errores y ausencia de cambios de datos cuando se rechaza una operación.
- Documentación y estado del documento ODD/espejo actualizados cuando correspondan.
- Sin refactors, cambios de stack, borrados de datos ni publicación que no se hayan autorizado.

Los hallazgos históricos de seguridad, RLS o tests con BD se verifican en un trabajo con alcance y entorno explícitos. No se presentan como bugs actuales solo porque figuren en memoria.
