import { query, tx } from '../config/db.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js';
import { calcularTotales, deCentavos, aCentavos } from '../utils/dinero.js';
import { paginar, respuestaPaginada } from '../utils/paginacion.js';
import { inicioDia, finDia } from '../utils/fechas.js';
import { obtenerConfig } from './configuracion.service.js';

/** Une líneas repetidas del mismo producto sumando cantidades. */
export function fusionarItems(items) {
  const m = new Map();
  for (const it of items) m.set(it.id_producto, (m.get(it.id_producto) || 0) + it.cantidad);
  return [...m].map(([id_producto, cantidad]) => ({ id_producto, cantidad }));
}

/**
 * Valida stock/estado de cada línea contra los productos YA bloqueados y devuelve los problemas.
 * Función pura: se prueba sin base de datos.
 */
export function validarLineas(items, productosPorId) {
  const problemas = [];
  for (const it of items) {
    const p = productosPorId.get(it.id_producto);
    if (!p) problemas.push({ id_producto: it.id_producto, codigo: 'PRODUCTO_NO_EXISTE', mensaje: `El producto ${it.id_producto} no existe.` });
    else if (!p.estado) problemas.push({ id_producto: p.id_producto, codigo: 'PRODUCTO_INACTIVO', mensaje: `${p.nombre} está desactivado y no se puede vender.` });
    else if (p.stock < it.cantidad) {
      problemas.push({ id_producto: p.id_producto, codigo: 'STOCK_INSUFICIENTE',
        mensaje: p.stock === 0 ? `${p.nombre} está agotado.` : `Stock insuficiente de ${p.nombre}: pides ${it.cantidad} y quedan ${p.stock}.` });
    }
  }
  return problemas;
}

/** Registra la venta dentro de una transacción ya abierta (la usa también la confirmación de voz). */
export async function registrarVentaEnTx(c, { usuario, items, id_cliente, metodo_pago, canal, clave_idempotencia, duracion_seg }) {
  const lineas = fusionarItems(items);
  const ids = lineas.map((l) => l.id_producto).sort((a, b) => a - b);
  // Bloqueo en orden de id para evitar interbloqueos entre ventas simultáneas.
  const { rows: prods } = await c.query('SELECT * FROM productos WHERE id_producto = ANY($1::int[]) ORDER BY id_producto FOR UPDATE', [ids]);
  const mapa = new Map(prods.map((p) => [p.id_producto, p]));
  const problemas = validarLineas(lineas, mapa);
  if (problemas.length) throw conflict(problemas[0].mensaje, problemas[0].codigo, problemas);

  if (id_cliente) {
    const { rows } = await c.query('SELECT estado FROM clientes WHERE id_cliente=$1', [id_cliente]);
    if (!rows[0]) throw badRequest('El cliente indicado no existe.');
    if (!rows[0].estado) throw badRequest('El cliente está desactivado.');
  }
  const cfg = await obtenerConfig(c);
  const detalle = lineas.map((l) => { const p = mapa.get(l.id_producto); return { ...l, nombre: p.nombre, precio: p.precio, costo: p.costo, stock: p.stock }; });
  const t = calcularTotales(detalle, cfg.tasa_impuesto);

  const { rows: [v] } = await c.query(
    `INSERT INTO ventas (subtotal, tasa_impuesto, impuesto, total, metodo_pago, canal, id_cliente, id_usuario, clave_idempotencia, duracion_seg)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id_venta`,
    [t.subtotal, cfg.tasa_impuesto, t.impuesto, t.total, metodo_pago, canal, id_cliente || null, usuario.id_usuario, clave_idempotencia || null, duracion_seg ?? null]);

  for (const d of detalle) {
    await c.query(
      `INSERT INTO detalle_venta (id_venta, id_producto, nombre_producto, cantidad, precio_unitario, costo_unitario, subtotal) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [v.id_venta, d.id_producto, d.nombre, d.cantidad, d.precio, d.costo, deCentavos(aCentavos(d.precio) * d.cantidad)]);
    const nuevo = d.stock - d.cantidad;
    await c.query('UPDATE productos SET stock=$1, actualizado_en=now() WHERE id_producto=$2', [nuevo, d.id_producto]);
    await c.query(
      `INSERT INTO movimientos_inventario (id_producto, tipo_movimiento, cantidad, stock_resultante, motivo, id_usuario, id_venta)
       VALUES ($1,'salida',$2,$3,$4,$5,$6)`,
      [d.id_producto, d.cantidad, nuevo, `Venta #${v.id_venta}`, usuario.id_usuario, v.id_venta]);
  }
  return v.id_venta;
}

async function ventaPorClave(id_usuario, clave) {
  const { rows } = await query('SELECT id_venta FROM ventas WHERE id_usuario=$1 AND clave_idempotencia=$2', [id_usuario, clave]);
  return rows[0]?.id_venta;
}

/** Venta atómica e idempotente: reintentar con la misma clave devuelve la misma venta. */
export async function crearVenta(usuario, d, canal = 'manual') {
  if (d.clave_idempotencia) {
    const previa = await ventaPorClave(usuario.id_usuario, d.clave_idempotencia);
    if (previa) return { venta: await obtenerVenta(previa, usuario), repetida: true };
  }
  try {
    const id = await tx((c) => registrarVentaEnTx(c, { usuario, ...d, canal }));
    return { venta: await obtenerVenta(id, usuario), repetida: false };
  } catch (e) {
    // Dos peticiones simultáneas con la misma clave: la segunda choca con el índice único.
    if (e.code === '23505' && d.clave_idempotencia) {
      const previa = await ventaPorClave(usuario.id_usuario, d.clave_idempotencia);
      if (previa) return { venta: await obtenerVenta(previa, usuario), repetida: true };
    }
    throw e;
  }
}

export async function obtenerVenta(id, usuario) {
  const { rows } = await query(
    `SELECT v.*, u.nombre || ' ' || u.apellido AS vendedor, nullif(trim(coalesce(c.nombre,'') || ' ' || coalesce(c.apellido,'')), '') AS cliente
       FROM ventas v JOIN usuarios u ON u.id_usuario=v.id_usuario LEFT JOIN clientes c ON c.id_cliente=v.id_cliente WHERE v.id_venta=$1`, [id]);
  const v = rows[0];
  if (!v) throw notFound('Venta no encontrada.');
  if (usuario.rol !== 'administrador' && v.id_usuario !== usuario.id_usuario) throw forbidden('Solo puedes ver tus propias ventas.');
  const det = await query('SELECT id_detalle, id_producto, nombre_producto, cantidad, precio_unitario, costo_unitario, subtotal FROM detalle_venta WHERE id_venta=$1 ORDER BY id_detalle', [id]);
  if (usuario.rol !== 'administrador') return { ...v, detalle: det.rows.map(({ costo_unitario, ...r }) => r) };
  const ganancia = det.rows.reduce((a, r) => a + aCentavos(r.subtotal) - aCentavos(r.costo_unitario) * r.cantidad, 0);
  return { ...v, ganancia: deCentavos(ganancia), detalle: det.rows };
}

export async function listarVentas(f, usuario) {
  const p = paginar(f);
  const w = []; const v = [];
  if (usuario.rol !== 'administrador') { v.push(usuario.id_usuario); w.push(`v.id_usuario=$${v.length}`); }
  else if (f.id_usuario) { v.push(f.id_usuario); w.push(`v.id_usuario=$${v.length}`); }
  if (f.desde) { v.push(f.desde); w.push(`v.fecha >= ${inicioDia(v.length)}`); }
  if (f.hasta) { v.push(f.hasta); w.push(`v.fecha < ${finDia(v.length)}`); }
  if (f.canal) { v.push(f.canal); w.push(`v.canal=$${v.length}`); }
  if (f.q) {
    v.push(`%${f.q}%`);
    w.push(`(c.nombre ILIKE $${v.length} OR c.apellido ILIKE $${v.length} OR v.id_venta::text = trim('%' from $${v.length}))`);
  }
  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const from = `FROM ventas v JOIN usuarios u ON u.id_usuario=v.id_usuario LEFT JOIN clientes c ON c.id_cliente=v.id_cliente`;
  const total = Number((await query(`SELECT count(*) ${from} ${where}`, v)).rows[0].count);
  const { rows } = await query(
    `SELECT v.id_venta, v.fecha, v.subtotal, v.impuesto, v.total, v.metodo_pago, v.canal, v.id_usuario,
            u.nombre || ' ' || u.apellido AS vendedor, nullif(trim(coalesce(c.nombre,'') || ' ' || coalesce(c.apellido,'')), '') AS cliente,
            (SELECT coalesce(sum(cantidad),0)::int FROM detalle_venta d WHERE d.id_venta=v.id_venta) AS unidades
       ${from} ${where} ORDER BY v.fecha DESC, v.id_venta DESC LIMIT ${p.porPagina} OFFSET ${p.offset}`, v);
  return respuestaPaginada(rows, total, p);
}
