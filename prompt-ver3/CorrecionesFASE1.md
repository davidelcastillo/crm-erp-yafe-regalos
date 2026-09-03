## Correciones de logica : 
1. En el forma del login src\app\login\components\LoginForm.tsx, cuando hay un login invalido, la consola tira ' status: 400,
  code: 'invalid_credentials'' pero en el front end se ve que dice login valido, redirigiendo; obviamente no deja entrar al sistema pero en el apartado visual hay que corregir eso

## Correciones Esteticas :
1. Existen 2 navbar, uno que solo sale en el login y luego se queda para siempre, en src\app\layout.tsx sale el componente Nav y luego internamente cada pagina crea su header que funciona como un 'navbar', se pide implementar el <LogoutButton /> en cada Navbar interno de cada pagina y eliminar el Nav actualmente en el layout.tsx, para eso de deberan modificar todas las page de cada modulo, eliminar el header y crear un componente Navbar dinamico que recopile las funcionalidades de cada header y el logout button. 
2. Implementar las esteticas, diseños y estilos que dicta el archivo STYLE.md para toda la pagina incluida el login.
