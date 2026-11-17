# Backlog y plan por sprints (Scrum)

Ocho sprints, cada uno con su criterio de aceptación verificable. (Las filas "Verificación" indican qué prueba lo respalda en el repositorio.)

| Sprint | Objetivo | Entregables principales | Verificación |
|---|---|---|---|
| 1 | Fundamentos y base de datos | Estructura del repositorio, `schema.sql` (8 + 2 tablas), `seed.sql`, configuración y conexión, manejo de errores | `db:init:demo` crea tablas y datos; consultas parametrizadas |
| 2 | Autenticación y usuarios | Login JWT/bcrypt, roles, middleware de permisos, CRUD de usuarios, perfil y cambio de contraseña | `tests/integration/auth.test.js` |
| 3 | Catálogo e inventario | Categorías, productos, movimientos (entrada/salida/ajuste), alertas de stock | `tests/integration/catalogo.test.js` |
| 4 | Clientes y venta manual | Clientes (vista limitada para vendedor), carrito, totales en servidor, venta atómica e idempotente | `tests/integration/ventas.test.js` |
| 5 | Historial, panel y reportes | Historial con filtros, panel con datos reales, reportes, CSV, configuración | `tests/integration/reportes.test.js` |
| 6 | Voz: interpretación | Normalización, cantidades, coincidencia aproximada, intenciones (vender, precio, stock, cancelar, confirmar, elegir), hook de reconocimiento y síntesis, panel de voz | `tests/unit/*.test.js` |
| 7 | Voz: confirmación y robustez | Pedido pendiente con caducidad, confirmación obligatoria, revalidación de stock, edición del pedido, ambigüedad, respaldo manual y sin soporte de voz | `tests/integration/voz.test.js`, `tests/e2e/navegador.cjs` |
| 8 | Pruebas, documentación y evaluación | Pruebas, README, API, instrumentos de evaluación (WER, SUS, interpretación, tiempos), limitaciones | `backend npm test`, `docs/` |

## Historias de usuario clave
- Como **vendedor**, quiero decir mi pedido en voz alta y confirmarlo, para vender sin tocar la pantalla.
- Como **vendedor**, quiero que el sistema me pida elegir cuando hay productos parecidos, para no vender el equivocado.
- Como **vendedor**, quiero poder vender manualmente si la voz falla, para no detener el negocio.
- Como **administrador**, quiero registrar entradas, salidas y ajustes con motivo, para tener inventario confiable.
- Como **administrador**, quiero ver ventas, productos más vendidos y alertas con datos reales, para decidir qué reponer.
- Como **administrador**, quiero ajustar el umbral de reconocimiento y el impuesto, para adaptar el sistema al negocio.

## Definición de terminado
Código en el repositorio, prueba automatizada que lo respalde, sin errores de consola, responsive y operable con teclado, y documentado en el README/API.
