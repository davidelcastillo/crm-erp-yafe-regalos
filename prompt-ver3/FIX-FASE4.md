1. En productos se siguen mostrando productos inactivos. En inventario también.
2. Sacar Inactivos del ButtonNav y ponerlo como un botón en inventario al lado del botón de exportar productos, ponerlo de otro color.
3. En compras se puede seleccionar varias sucursales por cada producto que se compra, simulando de que si compro de un productos y lo quiero llevar a 2 sucursales se podría, pero cuando se intenta registrar sale error con las sucursales, sin embargo, si intento nuevamente sin cerrar el modal y depsues de que salga el error si me deja registrar y si se almacenan correctamente en la bdd, corregir para que no salga ese error.
4. Se bugea el selector en el inventario, si selecciono solo filtrar por sucursal se queda internado en prismas querrys: 'prisma:query BEGIN
prisma:query DEALLOCATE ALL
prisma:query SELECT "public"."Category"."id", "public"."Category"."name" FROM "public"."Category" WHERE 1=1 ORDER BY "public"."Category"."name" ASC OFFSET $1
prisma:query COMMIT
 POST /inventario 200 in 1768ms (next.js: 5ms, proxy.ts: 478ms, application-code: 1285ms)
  └─ ƒ getCategoryOptions() in 1277ms src/app/actions/category.ts'
5. Que se limpie el selector que filtra de sucursales cada vez que se cambia de página, ejemplo de ventas a productos
6. En productos, no se muestra el total de todo el stock de cada producto en todas las sucursales al seleccionar en el filtro "Todas las Sucursales" esto también aplica a las demás páginas.Pero si se filtran por sucursales si salen lo que hay en cada sucursal.
7. Recargar la página de ventas cada vez que se vende
8. Tampoco sirve el filtro para seleccionar categorías en la página de inventarios, se queda internado con la consulta del punto 4.
9. La parte de exportar productos no la pude probar ya que toda la página de inventario esta bugeada y esta constantemente internado en el querry del punto 4.
10. Tampoco pude probar el mover stock por la misma razón anterior
11. Tampoco pude probar editar el stock de productos en la página de inventario por esa razón
12. Desde mi usuario admin no me deja borrar sucursales , el log me dice :' prisma:query ROLLBACK
Error deleting branch: Error: @supabase/auth-js: Expected parameter to be UUID but is not
    at deleteBranchUser (src\lib\utils\supabaseAuth.ts:142:45)
    at <unknown> (src\app\actions\branch.ts:245:50)
    at async deleteBranch (src\app\actions\branch.ts:199:20)
  140 |   userId: string
  141 | ): Promise<DeleteBranchUserResult> {
> 142 |   const { error } = await client.auth.admin.deleteUser(userId);
      |                                             ^
  143 |   return { error: error?.message ?? null };
  144 | }
  145 |
 POST /sucursales 200 in 3.8s (next.js: 6ms, proxy.ts: 555ms, application-code: 3.2s)
  └─ ƒ deleteBranch({"id":209}) in 3195ms src/app/actions/branch.ts.'
   Pero si me deja editar sucursales; Tambien me deja crear sucursales
13. Dentro de la pagina de sucursales, por cada sucursal, agregar un boton que sea para ir al login de la pagina /sucursal/id/inventario
14. AL intentar logerme con el usuario de una sucursale, no me redirije automaticamente a la pagina sucursal/id/inventory; Sino agregar un login externo exclusivo para esa sucursal, osea para esa pagina y que no se mexcle con el login del sistema central
15. Al intentar entrar en http://localhost:3000/sucursal/210/inventory con las creedenciales de la sucursal id=210 no me deja entrar y dice :  'Compiling /sucursal/[branchId]/inventory ...
Error: Route "/sucursal/[branchId]/inventory" used params.branchId. params is a Promise and must be unwrapped with await or React.use() before accessing its properties. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis
    at BranchInventoryPage (src\app\sucursal\[branchId]\inventory\page.tsx:15:36)
  13 |   params: { branchId: string };
  14 | }) {
> 15 |   const branchId = parseInt(params.branchId, 10);
     |                                    ^
  16 |
  17 |   // Validate branchId is a number
  18 |   if (isNaN(branchId)) {
prisma:query SELECT 1
prisma:query BEGIN
prisma:query DEALLOCATE ALL
prisma:query SELECT "public"."Branch"."id", "public"."Branch"."name" FROM "public"."Branch" WHERE "public"."Branch"."isActive" = $1 ORDER BY "public"."Branch"."name" ASC OFFSET $2
prisma:query COMMIT
 GET /sucursal/210/inventory 404 in 16.4s (next.js: 13.5s, proxy.ts: 852ms, application-code: 1971ms)
[browser] ⨯ unhandledRejection: TypeError: Failed to fetch'
