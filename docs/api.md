# API REST — resumen de endpoints

Todas las rutas cuelgan de `/api`. Autenticación: cabecera `Authorization: Bearer <token>` (se obtiene en `POST /api/auth/login`). Los errores tienen la forma `{ "error": { "codigo", "mensaje", "detalles?" } }`. Las listas devuelven `{ datos: [...], paginacion: { pagina, por_pagina, total, paginas } }` y aceptan `pagina` y `por_pagina` (máx. 100).

Los permisos se validan **en el servidor** (middleware `requiereRol`), no solo ocultando botones en la interfaz.


## Estado del servicio

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/salud` | Pública |

## Autenticación

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/auth/login` | Pública |
| GET | `/api/auth/me` | Cualquier usuario autenticado |
| PUT | `/api/auth/perfil` | Cualquier usuario autenticado |
| PUT | `/api/auth/contrasena` | Cualquier usuario autenticado |

## Usuarios y roles (solo administrador)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/roles` | Administrador |
| GET | `/api/usuarios` | Administrador |
| POST | `/api/usuarios` | Administrador |
| GET | `/api/usuarios/:id` | Administrador |
| PUT | `/api/usuarios/:id` | Administrador |
| PATCH | `/api/usuarios/:id/estado` | Administrador |

## Categorías: lectura para ambos roles, escritura solo administrador

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/categorias` | Administrador y vendedor |
| GET | `/api/categorias/:id` | Administrador y vendedor |
| POST | `/api/categorias` | Administrador |
| PUT | `/api/categorias/:id` | Administrador |
| PATCH | `/api/categorias/:id/estado` | Administrador |

## Productos

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/productos` | Administrador y vendedor |
| GET | `/api/productos/:id` | Administrador y vendedor |
| POST | `/api/productos` | Administrador |
| PUT | `/api/productos/:id` | Administrador |
| PATCH | `/api/productos/:id/estado` | Administrador |

## Inventario

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/inventario/alertas` | Administrador y vendedor |
| GET | `/api/inventario/movimientos` | Administrador |
| POST | `/api/inventario/movimientos` | Administrador |

## Clientes (vendedor: lista limitada y alta rápida; administrador: gestión completa)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/clientes` | Administrador y vendedor |
| GET | `/api/clientes/:id` | Administrador y vendedor |
| POST | `/api/clientes` | Administrador y vendedor |
| PUT | `/api/clientes/:id` | Administrador |
| PATCH | `/api/clientes/:id/estado` | Administrador |

## Ventas: sin edición ni borrado

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/ventas` | Administrador y vendedor |
| GET | `/api/ventas` | Administrador y vendedor |
| GET | `/api/ventas/:id` | Administrador y vendedor |

## Voz

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/voz/interpretar` | Administrador y vendedor |
| GET | `/api/voz/pedidos/:id` | Administrador y vendedor |
| POST | `/api/voz/pedidos/:id/confirmar` | Administrador y vendedor |
| POST | `/api/voz/pedidos/:id/cancelar` | Administrador y vendedor |
| POST | `/api/voz/pedidos/:id/resolver` | Administrador y vendedor |

## Dashboard (datos propios para el vendedor) y reportes (administrador)

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/dashboard` | Administrador y vendedor |
| GET | `/api/reportes/ventas` | Administrador |
| GET | `/api/reportes/productos-top` | Administrador |
| GET | `/api/reportes/vendedores` | Administrador |
| GET | `/api/reportes/metodos-pago` | Administrador |
| GET | `/api/reportes/inventario` | Administrador |
| GET | `/api/reportes/voz` | Administrador |
| GET | `/api/reportes/ventas.csv` | Administrador |
| GET | `/api/reportes/inventario-detalle` | Administrador (todos los productos con costo, precio, margen y valores) |
| GET | `/api/reportes/inventario.csv` | Administrador |

## Configuración: lectura para ambos (impuesto y nombre), escritura solo administrador

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/configuracion` | Administrador y vendedor |
| PUT | `/api/configuracion` | Administrador |

## Voz

| Método | Ruta | Acceso |
|---|---|---|
| PATCH | `/api/voz/pedidos/:id/items/:indice` | Administrador y vendedor |

## Notas de diseño

- **Ventas**: no existen rutas `PUT`/`PATCH`/`DELETE` sobre ventas; una venta registrada no se edita ni se elimina.
- **Idempotencia**: `POST /api/ventas` acepta `clave_idempotencia`; reintentar con la misma clave devuelve la misma venta (HTTP 200, `repetida: true`) sin descontar stock otra vez. En voz, la clave es `voz-<id_pedido>`.
- **Totales**: el servidor ignora cualquier total enviado por el cliente y lo calcula con los precios de la base de datos y el impuesto configurado.
- **Voz**: `POST /api/voz/interpretar` no modifica el inventario; solo crea/actualiza un pedido pendiente. El inventario cambia únicamente al confirmar (`/confirmar`), que vuelve a validar productos y stock dentro de una transacción.


## Costo y ganancia

- `productos.costo` es el precio de compra al proveedor. La ganancia de una venta es `subtotal − costo_unitario × cantidad` (sin impuesto); el costo se guarda en cada línea de venta, por lo que el histórico no cambia si luego se modifica el costo.
- El vendedor nunca recibe `costo`, `costo_unitario` ni `ganancia` (se eliminan en el servidor, no solo en pantalla).
- Reportes y panel (administrador) incluyen `ganancia`, `valor_a_costo`, `valor_a_precio_venta` y `ganancia_potencial`.
