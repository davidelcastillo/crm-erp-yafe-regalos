### Mejoras en el login

*** Archivo a Modificar / Leer ***
'./login/components/LoginForm.tsx'

*** Cambios a Realizar ****

1. Cambiar el color del boton del login, adaptar todos los componentes del login a los estilos de STYLE.md
2. Quitar la vista del ButtonNav (presente en el layout global), y que no se lo pueda ver desde la pagina de login

### Mejoras ux/ui en Modal Movimiento de stock

*** Archivo a Modificar / Leer ***
'./inventario/components/MoveStockModal.tsx'

*** Cambios a Realizar ***

1. Cambio estetico en el componente select id='ms-origen' -> Se require mejorar la visualización de los Option, usar algun estilo de tailwind paraa que coincida con la estetica de todo el sistema. Actualmente el opnions es el nativo del navegador.
2. Misma directriz anterior para el select id='ms-destino' -> Se require mejorar la visualización de los Option
3. Dentro de la seleccion de productos, no esta implementado el input para poner la cantidad requerida para el producto x, aunque si es un requisito para subir el form
4. Para los componentes añadidos anteriormente, se requiere tambien mejorar la estetica y adaptarla al STYLE.md

### Mejoras ux/ui en Modal Movimiento de stock

*** Archivo a Modificar / Leer ***

'./inventario/components/ExportWizard.tsx'

*** Cambios a Realizar ***


1. Mejorar la estetica del modal, recorrer el codigo y buscar todos aquellos componentes que no tenga estilos y aplicarle los estilos del STYLE para que se adapte a la estetica. Actualmente los componentes como inputs y opcion tienen los estilos del navegador pordefecto.