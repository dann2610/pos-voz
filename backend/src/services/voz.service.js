import { query, tx } from '../config/db.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { calcularTotales, dineroHablado } from '../utils/dinero.js';
import { obtenerConfig } from './configuracion.service.js';
import { registrarVentaEnTx, obtenerVenta } from './ventas.service.js';
import { interpretar, conProducto } from './voz/interprete.js';

const activos = async () => (await query('SELECT id_producto, nombre, descripcion, precio, stock FROM productos WHERE estado ORDER BY id_producto')).rows;

/** Totales de las líneas listas (estado ok). */
function resumen(items, tasa) {
  const ok = items.filter((i) => i.estado === 'ok');
  const t = calcularTotales(ok.map((i) => ({ precio: i.precio, cantidad: i.cantidad })), tasa);
  const pendientes = items.filter((i) => i.estado !== 'ok').length;
  return { lineas: ok.length, subtotal: t.subtotal, impuesto: t.impuesto, total: t.total, pendientes, listo: items.length > 0 && pendientes === 0 };
}

function frasePedido(items, r) {
  const ok = items.filter((i) => i.estado === 'ok');
  const lista = ok.map((i) => `${i.cantidad} ${i.nombre}`).join(', ');
  return `${lista}. Total ${dineroHablado(r.total)}.`;
}

/** Texto en pantalla y texto para sintetizar, según el estado del pedido. */
function mensajes(items, r) {
  if (!items.length) return { mensaje: 'El pedido está vacío.', habla: 'El pedido está vacío.' };
  const amb = items.findIndex((i) => i.estado === 'ambiguo');
  if (amb >= 0) {
    const it = items[amb];
    const ops = it.opciones.map((o, k) => `${k + 1}, ${o.nombre}${o.descripcion ? ' ' + o.descripcion : ''}`).join('. ');
    return { mensaje: `Hay varios productos para "${it.texto}". Elige uno.`, habla: `Encontré varios para ${it.texto}. ${ops}. ¿Cuál quieres?` };
  }
  const nf = items.find((i) => i.estado === 'no_encontrado');
  if (nf) return { mensaje: nf.mensaje, habla: `No encontré ${nf.texto}. Puedes quitarlo o intentar de nuevo.` };
  const ss = items.find((i) => i.estado === 'sin_stock');
  if (ss) return { mensaje: ss.mensaje, habla: `${ss.mensaje} Ajusta la cantidad o quítalo.` };
  return { mensaje: `Entendí: ${frasePedido(items, r)}`, habla: `Entendí: ${frasePedido(items, r)} ¿Confirmas la venta?` };
}

function respuestaPedido(p, tasa, extra = {}) {
  const items = p.items;
  const r = resumen(items, tasa);
  return {
    id_pedido: p.id_pedido, estado: p.estado, texto: p.texto, items, resumen: r, expira_en: p.expira_en,
    listo_para_confirmar: r.listo && p.estado === 'pendiente', id_venta: p.id_venta ?? null, ...mensajes(items, r), ...extra,
  };
}

async function cargarPedido(usuario, id, c = { query }, bloquear = false) {
  const { rows } = await c.query(`SELECT * FROM pedidos_voz WHERE id_pedido=$1 AND id_usuario=$2 ${bloquear ? 'FOR UPDATE' : ''}`, [id, usuario.id_usuario]);
  if (!rows[0]) throw notFound('Pedido por voz no encontrado.');
  return rows[0];
}

async function caducarVencidos(usuario, id) {
  await query(`UPDATE pedidos_voz SET estado='caducado' WHERE id_pedido=$1 AND id_usuario=$2 AND estado='pendiente' AND expira_en < now()`, [id, usuario.id_usuario]);
}

async function pendienteVigente(usuario, id) {
  if (!id) return null;
  await caducarVencidos(usuario, id);
  const { rows } = await query(`SELECT * FROM pedidos_voz WHERE id_pedido=$1 AND id_usuario=$2`, [id, usuario.id_usuario]);
  return rows[0]?.estado === 'pendiente' ? rows[0] : null;
}

async function guardar(usuario, items, texto, cfg, previo) {
  if (previo) {
    const { rows } = await query(
      `UPDATE pedidos_voz SET items=$1::jsonb, texto=$2, expira_en=now() + ($3 || ' minutes')::interval WHERE id_pedido=$4 RETURNING *`,
      [JSON.stringify(items), texto, String(cfg.minutos_caducidad), previo.id_pedido]);
    return rows[0];
  }
  // Un solo pedido pendiente por usuario: el nuevo reemplaza a los anteriores (sin movimientos de inventario).
  await query(`UPDATE pedidos_voz SET estado='cancelado' WHERE id_usuario=$1 AND estado='pendiente'`, [usuario.id_usuario]);
  const { rows } = await query(
    `INSERT INTO pedidos_voz (id_usuario, texto, items, expira_en) VALUES ($1,$2,$3::jsonb, now() + ($4 || ' minutes')::interval) RETURNING *`,
    [usuario.id_usuario, texto, JSON.stringify(items), String(cfg.minutos_caducidad)]);
  return rows[0];
}

export async function interpretarTexto(usuario, { texto, id_pedido }) {
  const cfg = await obtenerConfig();
  const productos = await activos();
  const pendiente = await pendienteVigente(usuario, id_pedido);
  const r = interpretar(texto, productos, { umbral: cfg.umbral_similitud, margen: cfg.margen_ambiguedad }, { hayPedidoPendiente: !!pendiente });
  const base = { intent: r.intent, texto_reconocido: texto };

  switch (r.intent) {
    case 'vender': {
      // Con un pedido en curso, lo nuevo SE SUMA al pedido (para empezar de cero: "cancelar el pedido").
      const previos = pendiente ? pendiente.items : [];
      const items = [...previos, ...r.items];
      const p = await guardar(usuario, items, texto, cfg, pendiente);
      return { ...base, ...respuestaPedido(p, cfg.tasa_impuesto) };
    }
    case 'seleccion': {
      const idx = pendiente.items.findIndex((i) => i.estado === 'ambiguo');
      if (idx < 0) return { ...base, ...respuestaPedido(pendiente, cfg.tasa_impuesto, { mensaje: 'No hay nada que elegir en este momento.', habla: 'No hay nada que elegir en este momento.' }) };
      const op = pendiente.items[idx].opciones[r.indice];
      if (!op) return { ...base, ...respuestaPedido(pendiente, cfg.tasa_impuesto, { mensaje: 'Esa opción no existe. Elige otra.', habla: 'Esa opción no existe. Elige otra.' }) };
      return { ...base, ...(await resolverItem(usuario, pendiente.id_pedido, { indice: idx, id_producto: op.id_producto })) };
    }
    case 'cancelar': {
      if (!pendiente) return { ...base, id_pedido: null, mensaje: 'No hay un pedido en curso para cancelar.', habla: 'No hay un pedido en curso para cancelar.' };
      const p = await cancelarPedido(usuario, pendiente.id_pedido);
      return { ...base, ...p, mensaje: 'Pedido cancelado. No se registró ninguna venta.', habla: 'Pedido cancelado.' };
    }
    case 'confirmar': {
      if (!pendiente) return { ...base, id_pedido: null, mensaje: 'No hay un pedido para confirmar. Dime qué quieres vender.', habla: 'No hay un pedido para confirmar. Dime qué quieres vender.' };
      const resp = respuestaPedido(pendiente, cfg.tasa_impuesto);
      return { ...base, ...resp, accion: resp.listo_para_confirmar ? 'confirmar' : null };
    }
    case 'consultar_precio':
    case 'consultar_stock': {
      const c = r.consulta;
      let mensaje; let habla;
      if (c.estado === 'ok') {
        const p = c.producto;
        if (r.intent === 'consultar_precio') {
          mensaje = `${p.nombre} cuesta $${Number(p.precio).toFixed(2)}.`; habla = `${p.nombre} cuesta ${dineroHablado(p.precio)}.`;
        } else {
          mensaje = p.stock === 0 ? `${p.nombre} está agotado.` : `Quedan ${p.stock} unidades de ${p.nombre}.`;
          habla = p.stock === 0 ? `${p.nombre} está agotado.` : `Quedan ${p.stock} unidades de ${p.nombre}.`;
        }
      } else if (c.estado === 'ambiguo') {
        const nombres = c.opciones.map((o) => o.nombre).join(', ');
        mensaje = `Hay varios productos parecidos: ${nombres}. Sé más específico.`; habla = `Hay varios productos parecidos: ${nombres}. Dime cuál.`;
      } else {
        mensaje = `No encontré "${c.frase}".`; habla = `No encontré ${c.frase}.`;
      }
      return { ...base, id_pedido: pendiente?.id_pedido ?? null, consulta: c, mensaje, habla };
    }
    default:
      return { ...base, id_pedido: pendiente?.id_pedido ?? null, mensaje: 'No entendí. Prueba con "vender dos Coca-Cola" o usa el modo manual.', habla: 'No entendí. Prueba de nuevo o usa el modo manual.' };
  }
}

export async function obtenerPedido(usuario, id) {
  await caducarVencidos(usuario, id);
  const cfg = await obtenerConfig();
  return respuestaPedido(await cargarPedido(usuario, id), cfg.tasa_impuesto);
}

async function pendienteOError(usuario, id) {
  await caducarVencidos(usuario, id);
  const p = await cargarPedido(usuario, id);
  if (p.estado === 'caducado') throw conflict('El pedido caducó. Dicta el pedido de nuevo.', 'PEDIDO_CADUCADO');
  if (p.estado !== 'pendiente') throw conflict(`El pedido ya está ${p.estado}.`, 'PEDIDO_NO_PENDIENTE');
  return p;
}

export async function resolverItem(usuario, id, { indice, id_producto }) {
  const p = await pendienteOError(usuario, id);
  const it = p.items[indice];
  if (!it) throw badRequest('El renglón indicado no existe.');
  const { rows } = await query('SELECT id_producto, nombre, descripcion, precio, stock, estado FROM productos WHERE id_producto=$1', [id_producto]);
  const prod = rows[0];
  const permitido = (it.opciones || []).some((o) => o.id_producto === id_producto);
  if (!prod || !prod.estado || !permitido) throw badRequest('Ese producto no es una de las opciones del renglón.');
  const items = p.items.map((x, k) => (k === indice ? conProducto({ texto: x.texto, cantidad: x.cantidad }, prod, 1) : x));
  const cfg = await obtenerConfig();
  const nuevo = await guardar(usuario, items, p.texto, cfg, p);
  return respuestaPedido(nuevo, cfg.tasa_impuesto);
}

/** Editar: cambiar cantidad de un renglón (se revalida el stock) o quitarlo. */
export async function modificarItem(usuario, id, indice, { cantidad }) {
  const p = await pendienteOError(usuario, id);
  const cfg = await obtenerConfig();
  const it = p.items[indice];
  if (!it) throw badRequest('El renglón indicado no existe.');
  let items;
  if (cantidad === 0) items = p.items.filter((_, k) => k !== indice);
  else {
    const { rows } = it.id_producto ? await query('SELECT id_producto, nombre, descripcion, precio, stock FROM productos WHERE id_producto=$1 AND estado', [it.id_producto]) : { rows: [] };
    items = p.items.map((x, k) => {
      if (k !== indice) return x;
      return rows[0] ? conProducto({ texto: x.texto, cantidad }, rows[0], x.score ?? 1) : { ...x, cantidad };
    });
  }
  const nuevo = await guardar(usuario, items, p.texto, cfg, p);
  return respuestaPedido(nuevo, cfg.tasa_impuesto);
}

export async function cancelarPedido(usuario, id) {
  await caducarVencidos(usuario, id);
  const p = await cargarPedido(usuario, id);
  if (p.estado === 'confirmado') throw conflict('El pedido ya fue confirmado; una venta registrada no se cancela desde aquí.', 'PEDIDO_CONFIRMADO');
  if (p.estado === 'pendiente') await query(`UPDATE pedidos_voz SET estado='cancelado' WHERE id_pedido=$1`, [id]);
  const cfg = await obtenerConfig();
  return respuestaPedido(await cargarPedido(usuario, id), cfg.tasa_impuesto);
}

/**
 * Confirma el pedido: re-valida productos/stock con bloqueo y registra la venta en una sola transacción.
 * Es idempotente: confirmar dos veces devuelve la misma venta.
 */
export async function confirmarPedido(usuario, id, { metodo_pago, id_cliente, duracion_seg }) {
  await caducarVencidos(usuario, id);
  const idVenta = await tx(async (c) => {
    const p = await cargarPedido(usuario, id, c, true);
    if (p.estado === 'confirmado') return p.id_venta;
    if (p.estado === 'caducado') throw conflict('El pedido caducó. Dicta el pedido de nuevo.', 'PEDIDO_CADUCADO');
    if (p.estado === 'cancelado') throw conflict('El pedido fue cancelado.', 'PEDIDO_CANCELADO');
    if (!p.items.length) throw badRequest('El pedido está vacío.');
    const sinResolver = p.items.filter((i) => ['ambiguo', 'no_encontrado', 'sin_stock'].includes(i.estado));
    if (sinResolver.length) throw badRequest(`Aún hay ${sinResolver.length} producto(s) sin resolver o sin stock. Elígelos, ajusta la cantidad o quítalos antes de confirmar.`, [{ codigo: 'PEDIDO_INCOMPLETO' }]);
    const id_venta = await registrarVentaEnTx(c, {
      usuario, items: p.items.map((i) => ({ id_producto: i.id_producto, cantidad: i.cantidad })), id_cliente, metodo_pago,
      canal: 'voz', clave_idempotencia: `voz-${id}`, duracion_seg,
    });
    await c.query(`UPDATE pedidos_voz SET estado='confirmado', id_venta=$1 WHERE id_pedido=$2`, [id_venta, id]);
    return id_venta;
  });
  const venta = await obtenerVenta(idVenta, usuario);
  return { venta, habla: `Venta registrada. Total ${dineroHablado(venta.total)}.`, mensaje: `Venta #${venta.id_venta} registrada por $${venta.total}.` };
}
