-- =====================================================================
-- POS accesible por voz - Esquema PostgreSQL (crear desde cero)
-- 8 entidades principales + 2 tablas auxiliares justificadas:
--   configuracion_negocio : parámetros comerciales (impuesto, umbrales de voz)
--   pedidos_voz           : pedidos pendientes de confirmación (caducan)
-- La idempotencia de ventas se resuelve con la columna ventas.clave_idempotencia.
-- =====================================================================
BEGIN;

DROP TABLE IF EXISTS pedidos_voz CASCADE;
DROP TABLE IF EXISTS movimientos_inventario CASCADE;
DROP TABLE IF EXISTS detalle_venta CASCADE;
DROP TABLE IF EXISTS ventas CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS configuracion_negocio CASCADE;

CREATE TABLE roles (
  id_rol       SERIAL PRIMARY KEY,
  nombre       VARCHAR(30)  NOT NULL UNIQUE,
  descripcion  VARCHAR(150)
);

CREATE TABLE usuarios (
  id_usuario      SERIAL PRIMARY KEY,
  nombre          VARCHAR(60)  NOT NULL,
  apellido        VARCHAR(60)  NOT NULL,
  correo          VARCHAR(100) NOT NULL,
  contrasena      VARCHAR(255) NOT NULL,          -- hash bcrypt
  estado          BOOLEAN      NOT NULL DEFAULT TRUE,
  id_rol          INT          NOT NULL REFERENCES roles(id_rol),
  fecha_registro  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_usuarios_correo ON usuarios (lower(correo));

CREATE TABLE categorias (
  id_categoria    SERIAL PRIMARY KEY,
  nombre          VARCHAR(60)  NOT NULL,
  descripcion     VARCHAR(150),
  estado          BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_categorias_nombre ON categorias (lower(nombre));

CREATE TABLE productos (
  id_producto     SERIAL PRIMARY KEY,
  nombre          VARCHAR(100)  NOT NULL,
  descripcion     VARCHAR(150),
  costo           NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (costo >= 0),   -- costo de compra al proveedor
  precio          NUMERIC(10,2) NOT NULL CHECK (precio >= 0),            -- precio de venta
  stock           INT           NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_minimo    INT           NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  estado          BOOLEAN       NOT NULL DEFAULT TRUE,
  id_categoria    INT           NOT NULL REFERENCES categorias(id_categoria),
  creado_en       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_productos_nombre_desc ON productos (lower(nombre), lower(coalesce(descripcion, '')));
CREATE INDEX ix_productos_categoria ON productos (id_categoria);
CREATE INDEX ix_productos_estado ON productos (estado);

CREATE TABLE clientes (
  id_cliente      SERIAL PRIMARY KEY,
  nombre          VARCHAR(60)  NOT NULL,
  apellido        VARCHAR(60),
  identificacion  VARCHAR(20),
  telefono        VARCHAR(20),
  correo          VARCHAR(100),
  direccion       VARCHAR(150),
  estado          BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_clientes_identificacion ON clientes (identificacion) WHERE identificacion IS NOT NULL;

CREATE TABLE ventas (
  id_venta           SERIAL PRIMARY KEY,
  fecha              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  subtotal           NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  tasa_impuesto      NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (tasa_impuesto >= 0),  -- tasa vigente al vender
  impuesto           NUMERIC(10,2) NOT NULL CHECK (impuesto >= 0),
  total              NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  metodo_pago        VARCHAR(30)   NOT NULL CHECK (metodo_pago IN ('efectivo','transferencia','otro')),
  canal              VARCHAR(10)   NOT NULL DEFAULT 'manual' CHECK (canal IN ('manual','voz')),
  id_cliente         INT REFERENCES clientes(id_cliente),
  id_usuario         INT           NOT NULL REFERENCES usuarios(id_usuario),
  clave_idempotencia VARCHAR(80),
  duracion_seg       INT CHECK (duracion_seg IS NULL OR duracion_seg >= 0)          -- para medir tiempo de registro
);
CREATE UNIQUE INDEX ux_ventas_idem ON ventas (id_usuario, clave_idempotencia) WHERE clave_idempotencia IS NOT NULL;
CREATE INDEX ix_ventas_fecha ON ventas (fecha);
CREATE INDEX ix_ventas_usuario ON ventas (id_usuario);
CREATE INDEX ix_ventas_cliente ON ventas (id_cliente);

CREATE TABLE detalle_venta (
  id_detalle       SERIAL PRIMARY KEY,
  id_venta         INT           NOT NULL REFERENCES ventas(id_venta),
  id_producto      INT           NOT NULL REFERENCES productos(id_producto),
  nombre_producto  VARCHAR(100)  NOT NULL,                 -- nombre histórico
  cantidad         INT           NOT NULL CHECK (cantidad > 0),
  precio_unitario  NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),  -- precio histórico
  costo_unitario   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0), -- costo histórico (para la ganancia)
  subtotal         NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0)
);
CREATE INDEX ix_detalle_venta ON detalle_venta (id_venta);
CREATE INDEX ix_detalle_producto ON detalle_venta (id_producto);

CREATE TABLE movimientos_inventario (
  id_movimiento    SERIAL PRIMARY KEY,
  id_producto      INT         NOT NULL REFERENCES productos(id_producto),
  tipo_movimiento  VARCHAR(10) NOT NULL CHECK (tipo_movimiento IN ('entrada','salida','ajuste')),
  cantidad         INT         NOT NULL CHECK (cantidad > 0),   -- para 'ajuste' ver stock_resultante
  stock_resultante INT         NOT NULL CHECK (stock_resultante >= 0),
  motivo           VARCHAR(150) NOT NULL,
  fecha            TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_usuario       INT         NOT NULL REFERENCES usuarios(id_usuario),
  id_venta         INT         REFERENCES ventas(id_venta)
);
CREATE INDEX ix_mov_producto ON movimientos_inventario (id_producto, fecha DESC);
CREATE INDEX ix_mov_fecha ON movimientos_inventario (fecha);

-- Auxiliar 1: configuración del negocio (una sola fila)
CREATE TABLE configuracion_negocio (
  id                   INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nombre_negocio       VARCHAR(100)  NOT NULL DEFAULT 'Mi negocio',
  tasa_impuesto        NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (tasa_impuesto >= 0 AND tasa_impuesto <= 100),
  umbral_similitud     NUMERIC(3,2)  NOT NULL DEFAULT 0.60 CHECK (umbral_similitud BETWEEN 0.30 AND 1),
  margen_ambiguedad    NUMERIC(3,2)  NOT NULL DEFAULT 0.08 CHECK (margen_ambiguedad BETWEEN 0 AND 0.5),
  minutos_caducidad    INT           NOT NULL DEFAULT 5 CHECK (minutos_caducidad BETWEEN 1 AND 60),
  actualizado_en       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Auxiliar 2: pedidos por voz pendientes (la confirmación corresponde a un pedido y caduca)
CREATE TABLE pedidos_voz (
  id_pedido    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario   INT         NOT NULL REFERENCES usuarios(id_usuario),
  texto        VARCHAR(300) NOT NULL,
  items        JSONB       NOT NULL,
  estado       VARCHAR(12) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmado','cancelado','caducado')),
  id_venta     INT REFERENCES ventas(id_venta),
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_en    TIMESTAMPTZ NOT NULL
);
CREATE INDEX ix_pedidos_voz_usuario ON pedidos_voz (id_usuario, estado);

COMMIT;
