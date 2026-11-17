# POS por voz — Punto de venta accesible con interacción por voz

Sistema de Punto de Venta (POS) para microcomerciantes, con **venta por voz y modo manual siempre disponible**.
Proyecto académico: *Diseño e implementación de un sistema de Punto de Venta (POS) accesible basado en interacción por voz para la inclusión digital de microcomerciantes*.

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite, React Router, lucide-react, Web Speech API (JavaScript, módulos ES) |
| Backend | Node.js 20+ y Express 5 (API REST), JWT, bcrypt, zod, helmet, cors, express-rate-limit |
| Base de datos | PostgreSQL 14+ (consultas parametrizadas, PK/FK/CHECK, índices, transacciones) |
| Pruebas | `node:test` (unitarias + integración contra una BD de pruebas aparte), prueba de navegador opcional (Playwright) |

Arquitectura de tres capas: **la interfaz nunca habla con la base de datos**; solo consume la API (`/api`). Más detalle en [`docs/arquitectura.md`](docs/arquitectura.md).

## Requisitos
- Node.js 20 o superior y npm
- PostgreSQL 14 o superior (probado con 16) y permiso para crear bases de datos
- Para voz: Google Chrome o Microsoft Edge (Web Speech API), micrófono y conexión a internet; en producción, HTTPS

## Instalación

```bash
# 1) Base de datos (psql o pgAdmin): un usuario y dos bases (desarrollo y pruebas)
psql -U postgres -c "CREATE ROLE pos LOGIN PASSWORD 'cambia_esta_clave' CREATEDB;"
psql -U postgres -c "CREATE DATABASE pos_voz OWNER pos;"
psql -U postgres -c "CREATE DATABASE pos_voz_test OWNER pos;"     # solo para las pruebas

# 2) Backend
cd backend
npm install
cp .env.example .env          # Windows: copy .env.example .env
#   Edita .env: DATABASE_URL, JWT_SECRET (>= 32 caracteres), DEMO_ADMIN_PASSWORD, DEMO_VENDEDOR_PASSWORD
#   Para generar un secreto:  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm run db:init:demo          # crea las tablas y carga datos de demostración (BORRA lo existente)

# 3) Frontend
cd ../frontend
npm install
```

`npm run db:init` crea solo el esquema y los roles (sin datos demo ni usuarios: tendrías que crear el primer administrador por SQL). Usa `db:init:demo` para empezar.

## Ejecución

Desarrollo (dos terminales):

```bash
cd backend  && npm run dev      # API en http://localhost:4000/api
cd frontend && npm run dev      # Interfaz en http://localhost:5173 (proxy de /api al backend)
```

Modo "todo en uno" (el backend sirve la interfaz compilada):

```bash
cd frontend && npm run build
cd ../backend && SERVE_FRONTEND=true npm start      # Windows (PowerShell): $env:SERVE_FRONTEND="true"; npm start
# Abre http://localhost:4000
```

**Usuarios demo** (las contraseñas son las que definiste en `.env`): `admin@demo.com` (Administrador) y `vendedor@demo.com` (Vendedor). Cámbialas o desactívalas antes de usar el sistema con datos reales.

## Qué incluye (14 módulos)
1. **Autenticación** (JWT, bcrypt, límite de intentos de login, sesión validada contra la BD en cada petición: un usuario desactivado pierde el acceso al instante).
2. **Panel** con datos reales (ventas del día y mes, últimos 7 días, más vendidos, alertas).
3. **Usuarios** (solo administrador; no se puede desactivar al último administrador ni a uno mismo).
4. **Categorías**, 5. **Productos** (el stock solo cambia por inventario o ventas), 6. **Inventario** (entradas, salidas, ajustes con motivo, alertas de stock bajo/agotado e **inventario valorado** con descarga CSV). Cada producto tiene **costo de compra** y precio de venta: el administrador ve ganancia diaria/mensual, margen, productos más rentables y el valor del inventario a costo y a precio de venta; el vendedor no ve costos. El historial permite **imprimir el comprobante de venta** (documento no tributario; no es factura electrónica del SRI). Los datos demo incluyen un catálogo de 120 productos con marcas ecuatorianas y varias presentaciones; la voz usa la descripción ("coca cola 500") para distinguirlas y pregunta si hay duda.
7. **Clientes** (opcionales en la venta; el vendedor ve datos limitados).
8. **Venta manual** (carrito, impuesto configurado, método de pago, historial).
9. **Interacción por voz**: micrófono grande, estado de escucha, texto reconocido (editable), respuesta hablada, repetir/editar/cancelar.
10. **Normalización y coincidencia aproximada** (tildes, plurales, grafías fonéticas, números en palabras, Levenshtein) con umbral configurable. Si hay empate entre productos, **pide elegir; nunca adivina en silencio**.
11. **Confirmación obligatoria** de la venta por voz: el pedido pendiente caduca, el servidor revalida stock y registra de forma atómica e idempotente.
12. **Historial de ventas** (las ventas no se editan ni se eliminan).
13. **Reportes** con datos reales y gráficos, exportación CSV, indicadores de voz.
14. **Configuración** (negocio, impuesto, umbrales de voz, caducidad del pedido).

Comandos de voz de ejemplo: «Vender dos Coca-Cola», «¿Cuánto cuesta la leche?», «¿Cuántas unidades quedan de arroz?», «el segundo» (para elegir), «Confirmar la venta», «Cancelar el pedido actual».

## Pruebas

```bash
cd backend
npm test                       # unitarias + integración (usa la BD pos_voz_test; la recrea en cada archivo)
cd ../frontend && npm test     # utilidades del frontend
```

- `npm test` en `backend` deriva la BD de pruebas de `DATABASE_URL` (`…/pos_voz_test`) o de `TEST_DATABASE_URL`, y **se niega a correr contra la BD de desarrollo**.
- Opcional, prueba de navegador real: ver el encabezado de [`tests/e2e/navegador.cjs`](tests/e2e/navegador.cjs). El reconocimiento de voz allí es **simulado**.
- Colección de Postman: [`docs/postman_collection.json`](docs/postman_collection.json). Resumen de endpoints: [`docs/api.md`](docs/api.md).

### Estado verificado de las pruebas
Última ejecución completa en el entorno de desarrollo (Node 22, PostgreSQL 16): **backend 77 pruebas OK** (unitarias de normalización, cantidades, coincidencia aproximada, intérprete, totales, validación de inventario y métricas; integración de login, permisos por rol, CRUD, inventario, ventas atómicas, idempotencia, concurrencia sobre la última unidad, flujo de voz con confirmación, cancelación, stock insuficiente, producto inexistente, nombres parecidos, pedido caducado, reportes y CSV) y **frontend 5 pruebas OK**. Una prueba de navegador con Chromium recorrió login, venta por voz (con voz simulada) y manual, roles, vista móvil y navegador sin soporte de voz.

## Evaluación (WER, interpretación, tiempo, SUS)
Los instrumentos y fórmulas están listos (`backend/scripts/wer.js`, `sus.js`, `interpretacion.js`, tiempos en *Reportes → Indicadores de voz*), pero **no hay resultados**: requieren sesiones con usuarios reales y no se han inventado cifras. Ver [`docs/evaluacion.md`](docs/evaluacion.md).

## Seguridad y privacidad
- Contraseñas con bcrypt; secretos solo en variables de entorno (`.env` está en `.gitignore`); consultas SQL parametrizadas; helmet y CORS restringido; límite de intentos de login; errores sin trazas internas; permisos validados en el servidor.
- **No se almacena audio.** Pero el reconocimiento de voz lo hace el **navegador** (Web Speech API) y, según el navegador, **puede enviar el audio a un servicio externo** (p. ej., Google en Chrome). No se afirma que el audio nunca salga del dispositivo.
- El token JWT se guarda en `localStorage` (simplicidad académica); ver limitaciones.

## Limitaciones conocidas
Ver [`docs/limitaciones.md`](docs/limitaciones.md). Principales: precisión de voz dependiente del navegador/ruido/acento y **no medida aún**; solo cantidades enteras; números hasta 100; sin facturación electrónica ni SRI, sin pagos en línea ni integración bancaria, sin contabilidad; sin modo offline.

## Estructura
```
pos-voz/
├── backend/        src/{config,routes,controllers,services,middleware,validators,utils}, scripts/
├── frontend/       src/{components,pages,layouts,services,hooks,context,utils,styles}
├── database/       schema.sql, seed.sql
├── tests/          unit/, integration/, e2e/
├── docs/           arquitectura, api, backlog Scrum, evaluación, limitaciones, Postman
├── .env.example    (copia de backend/.env.example; el archivo que se usa es backend/.env)
└── README.md
```
