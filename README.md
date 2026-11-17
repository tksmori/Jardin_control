# JardínControl

Aplicación privada de inventario para un jardín infantil en Chile. Proyecto de portafolio de Braulio Brevis, pensado para la administración diaria de Marité.

Su objetivo es registrar existencias por ubicación con un historial trazable: cada cambio de cantidad pasa por un movimiento. Incluye exactamente cinco apartados: Inventario salas, Materiales JUNJI, Material de bodega, Comedor y Oficina. El resumen y el historial son herramientas generales.

## Requisitos e instalación

Node.js 24 LTS recomendado (mínimo 22.12), npm y un navegador moderno. No requiere Docker ni un servidor propio.

```bash
npm ci
npm run dev
```

Durante la preparación en este equipo se instaló Node localmente en `.runtime/`, sin cambiar el sistema. Si tu terminal todavía no reconoce `node` o `npm`, primero ejecuta desde esta carpeta:

```bash
export PATH="$PWD/.runtime/bin:$PATH"
```

Vite informa la dirección disponible (por defecto http://127.0.0.1:5173). Mantén abierta la terminal del servidor. No se necesitan credenciales para probar localmente el modo demo.

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

Las pruebas de base de datos ejecutan la migración en PostgreSQL embebido mediante PGlite, con roles y funciones Auth simulados. Verifican permisos y transacciones sin conectarse a servicios reales; no prueban el servicio Auth de Supabase ni concurrencia entre conexiones PostgreSQL independientes.

Para las pruebas de navegador, deja iniciado `npm run dev` en otra terminal:

```bash
npx playwright install chromium
npm run test:e2e
```

En este equipo Chromium quedó instalado dentro del proyecto. Para usar esa copia:

```bash
PLAYWRIGHT_BROWSERS_PATH="$PWD/.runtime/browsers" npm run test:e2e
```

`package-lock.json` fija las versiones instaladas. Usa `npm ci` para reproducirlas.

## Funcionalidades

- Dashboard con catálogo, siete salas, alertas y últimos movimientos.
- Tabla general de salas, selección individual, búsqueda y filtros. Los totales verticales agrupan unidades; nunca suman litros con rollos.
- Catálogo único: crear un material lo deja en cero en todas las ubicaciones; un ingreso establece sus existencias.
- Ingresos, consumos y traslados con revisión antes de confirmar. Los traslados conservan el inventario total.
- Reposición desde bodega a siete salas y tres baños: entrega de consumibles para uso. Descuenta origen y guarda el detalle; **no** crea existencias en destino. Usa un traslado cuando las unidades deban seguir inventariadas en la sala.
- JUNJI es un atributo del material, nunca una ubicación ni una segunda copia de existencias.
- Historial por material/tipo/ubicación, detalle de entregas, usuario, fecha de operación y fecha de registro. Las correcciones agregan un movimiento con referencia al original. Revisa manualmente la cantidad y las ubicaciones de la compensación.
- CSV compatible con Excel (UTF-8 BOM, separador punto y coma); importación CSV/XLSX con plantilla, previsualización, validaciones y confirmación. Hasta 1.000 filas y 5 MB. Una fila por material **nuevo**, no admite duplicados. Para agregar cantidades de un material existente, registra un ingreso o traslado.
- Cantidades con hasta tres decimales; unidad, rollo y paquete exigen enteros.
- El mínimo se define para el total de cada material; las tablas por ubicación también muestran cuando sus existencias locales están bajo ese umbral. No hay umbrales independientes por sala en esta versión.

## Modo demo y producción

En `npm run dev`, sin configuración de Supabase, se utiliza demo automáticamente. También puede activarse expresamente con `VITE_DEMO_MODE=true`. Las existencias y el historial ficticios se guardan en `localStorage` del navegador y se pueden reiniciar con confirmación desde el pie de página. Se usa Web Locks cuando el navegador lo soporta para coordinar pestañas.

**Una compilación de producción no activa demo por defecto.** Sin configuración muestra instrucciones de configuración. Para una demostración compilada explícita:

```bash
VITE_DEMO_MODE=true npm run build
```

No uses demo para información real: el almacenamiento del navegador no proporciona autenticación ni respaldos. Al conectar Supabase la demo no se migra automáticamente.

## Arquitectura

```text
src/
  App.tsx                 Sesión, navegación y coordinación
  components/             Diálogos, encabezados y tabla de movimientos
  pages/                  Dashboard, inventario e historial
  features/               Formularios de inventario, movimientos y acceso
  data/demo.ts            Datos ficticios y ubicaciones
  lib/engine.ts           Validación y motor de movimientos demo
  lib/import.ts           Importación y exportación
  repositories/demo.ts    Persistencia local
  repositories/supabase.ts Adaptador RPC y cliente Auth
  types/inventory.ts      Contrato común del repositorio y entidades
  tests/                  Reglas de negocio, importación y migración PostgreSQL
e2e/                      Flujos en Chromium y diseño móvil
supabase/migrations/      Migración transaccional del esquema y funciones
public/_redirects         Fallback SPA para Cloudflare Pages
vercel.json               Fallback SPA para Vercel
```

React, TypeScript, Vite, Tailwind CSS con plugin Vite, Lucide React, React Router, Supabase JS, Papa Parse, read-excel-file y Vitest. El CSS define los componentes visuales sobre Tailwind; la interfaz no depende de fuentes ni imágenes remotas.

Los repositorios implementan `InventoryRepository`. El backend vuelve a validar todas las reglas en PostgreSQL; la validación del frontend no es un control de seguridad. `record_movement` bloquea la fila del material antes de tocar balances, serializando las operaciones concurrentes sobre ese material. Cada RPC se ejecuta en una sola transacción. La importación completa se revierte si alguna fila falla.

## Configurar Supabase

1. Crea un proyecto en Supabase y conserva su contraseña de base de datos fuera del repositorio.
2. En SQL Editor ejecuta completo `supabase/migrations/202611160001_inventory.sql` sobre un proyecto nuevo. Es una migración de una sola aplicación, no un script para volver a ejecutar en un esquema existente. No carga materiales demo en producción.
3. Alternativa con Supabase CLI instalada: ejecuta `supabase login`, `supabase link --project-ref TU_REFERENCIA`, revisa `supabase db push --dry-run` y luego `supabase db push`. No se ejecutó ninguna migración remota durante la creación del proyecto.
4. En Authentication deshabilita el registro público de nuevos usuarios y el acceso anónimo. Crea manualmente la cuenta de la directora desde el panel de usuarios y asigna su contraseña de forma privada.
5. Copia el UUID de esa cuenta y autorízala desde SQL Editor:

```sql
insert into public.authorized_users (user_id, role, active)
values ('UUID_REAL_DE_AUTH_USERS', 'admin', true);
```

El marcador debe reemplazarse por un UUID existente de `auth.users`. Una cuenta Auth sin esta autorización no puede leer el inventario ni llamar a las operaciones de escritura. No hay pantalla ni endpoint de registro público en la aplicación. Solo el administrador de Supabase puede gestionar esta lista.

6. Copia `.env.example` a `.env.local` y completa:

```dotenv
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
VITE_DEMO_MODE=false
```

Estas dos variables Vite son públicas por diseño. Nunca uses una clave `service_role`, clave secreta, contraseña PostgreSQL o token personal en el frontend. Reinicia Vite después de cambiar variables. En despliegue deben configurarse **antes** de compilar.

7. Inicia sesión y prueba con un material nuevo, ingreso, consumo y traslado. Comprueba también una cuenta sin autorización y una sesión cerrada. La verificación con un proyecto Supabase real requiere tus credenciales y no se sustituye por pruebas locales.

Para revocar acceso:

```sql
update public.authorized_users set active=false where user_id='UUID_REAL_DE_AUTH_USERS';
```

RLS aplica a todas las tablas. El cliente autenticado solo puede leer cuando está autorizado y escribe mediante las funciones RPC, que vuelven a verificar autorización. Los movimientos y sus detalles rechazan UPDATE y DELETE incluso desde SQL; corrige mediante compensaciones. No otorgues permisos adicionales a `anon` o `authenticated`.

## Respaldo e intercambio con Excel

Desde cada módulo exporta el CSV de inventario. Desde Historial exporta los movimientos; las reposiciones se exportan con una fila por destino. Los filtros actuales afectan a ambas exportaciones. Conserva copias fechadas en un lugar privado. El catálogo, las cantidades y el historial deben respaldarse juntos.

Si Excel no detecta el separador, usa Datos → Desde texto/CSV, UTF-8 y punto y coma. Descarga la plantilla desde Importar; conserva sus encabezados y usa los nombres de categorías/ubicaciones disponibles. `junji` y `consumible` aceptan sí/no. El catálogo distingue materiales por nombre (sin diferenciar mayúsculas ni espacios en los extremos). Los valores decimales aceptan coma o punto.

Un CSV de inventario exportado no es una restauración completa y puede contener varias filas por material; el importador inicial las rechazará como duplicadas. El historial exportado no se reimporta. Para recuperación integral en producción, utiliza además los mecanismos de respaldo/volcado PostgreSQL disponibles para tu proyecto Supabase y verifica una restauración en un entorno separado. Revisa disponibilidad y límites del plan gratuito vigente antes de depender de ellos.

## Publicar en GitHub (paso manual)

No se publicó ningún repositorio ni despliegue automáticamente. Crea un repositorio vacío en GitHub; desde una copia del proyecto en un directorio con metadatos Git escribibles:

```bash
git init
git add .
git status
# Revisa que no haya credenciales, .env.local, node_modules, dist ni .runtime.
git commit -m "Implementa MVP de JardínControl"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/jardincontrol.git
git push -u origin main
```

Si `.git` ya existe y es un repositorio válido, omite `git init`. En el workspace original `.git` era un directorio protegido, vacío y de solo lectura; no se modificó ni se creó un commit.

## Cloudflare Pages

Conecta manualmente el repositorio en Cloudflare Pages. Framework: React/Vite; comando de build `npm run build`; salida `dist`; Node 24. Configura las variables Supabase en el entorno de producción y deja `VITE_DEMO_MODE=false`. `public/_redirects` conserva las rutas de React Router al recargar. Tras desplegar, verifica rutas directas, inicio/cierre de sesión y cuentas no autorizadas. Añade la URL pública a la configuración de URLs de Auth si posteriormente incorporas recuperación de contraseñas.

## Vercel

Si el uso cumple las condiciones vigentes de tu plan, importa manualmente el repositorio. Preset Vite; build `npm run build`; salida `dist`; Node 24 y las mismas variables. `vercel.json` configura las rutas SPA. Revisa límites y condiciones del proveedor antes de publicar. No requiere funciones serverless propias.

## Límites y próximos pasos

- La integración real de Auth y red con Supabase necesita un proyecto configurado; sin él no se puede verificar de extremo a extremo.
- No hay recuperación de contraseña, gestión visual de usuarios, edición de catálogo ni borrado de materiales. Los usuarios se gestionan desde Supabase.
- JUNJI se asigna al material completo. Si un mismo producto proviene de fuentes distintas, usa entradas de catálogo diferenciadas; una futura versión puede añadir lotes por origen.
- Sin paginación remota: el snapshot y el historial cargan completos. Para un volumen grande incorporar consultas paginadas.
- Los movimientos compensatorios son explícitos y revisables, no una anulación automática ni un ajuste directo de saldo.
- Demo utiliza almacenamiento local; si se borra, se pierde el trabajo demo. Navegadores sin Web Locks no garantizan escritura simultánea entre pestañas.
- Evolución prevista: mínimos por ubicación, lotes por origen, pruebas reales contra Supabase de desarrollo, recuperación de contraseña y respaldos automáticos.

## Validación de esta entrega

Comprobación realizada el 16 de noviembre de 2026:

- 24 pruebas Vitest aprobadas: 13 del motor, 3 de importación CSV y 8 de migración/permisos PostgreSQL.
- 4 pruebas Playwright aprobadas en Chromium: creación de material, ingreso, consumo, traslado y persistencia; reposición de 26 rollos en diez destinos con saldo 74; importación CSV; navegación móvil; importación XLSX decimal y descarga CSV.
- TypeScript, ESLint y compilación de producción ejecutados sin errores.
- HTTP 200 comprobado en el servidor local. Capturas de escritorio (1440 px) y móvil (390 px) inspeccionadas. La prueba móvil verifica además que la página no desborde horizontalmente; la tabla tiene su propio desplazamiento.
- La herramienta de navegador avisó que utilizó un binario alternativo para este sistema operativo; las cuatro pruebas finalizaron correctamente. Esta validación no incluye teléfonos físicos, Safari ni Firefox.
- Supabase remoto, su servicio Auth y concurrencia entre conexiones independientes siguen pendientes de comprobación en un proyecto de desarrollo real.

## Referencias oficiales consultadas

- [Vite: instalación y requisitos](https://vite.dev/guide/)
- [Tailwind CSS con Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Supabase: funciones PostgreSQL](https://supabase.com/docs/guides/database/functions)
- [Supabase: RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: correo y contraseña](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)
- [Cloudflare Pages: React](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)
