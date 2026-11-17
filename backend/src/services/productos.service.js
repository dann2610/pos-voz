import { query, tx } from '../config/db.js';
import { badRequest, notFound } from '../utils/errors.js';
import { paginar, respuestaPaginada } from '../utils/paginacion.js';

const SEL = `SELECT p.*, c.nombre AS categoria,
  CASE WHEN p.stock = 0 THEN 'agotado' WHEN p.stock <= p.stock_minimo THEN 'bajo' ELSE 'normal' END AS stock_estado
  FROM productos p JOIN categorias c ON c.id_categoria = p.id_categoria`;

// El costo de compra y la ganancia son información del negocio: solo el administrador los ve.
const vista = (p, usuario) => { if (usuario.rol === 'administrador') return p; const { costo, ...resto } = p; return resto; };

export async function listar(f, usuario) {
  const p = paginar(f);
  const w = []; const v = [];
  if (f.q) { v.push(`%${f.q}%`); w.push(`(p.nombre ILIKE $${v.length} OR p.descripcion ILIKE $${v.length})`); }
  if (f.id_categoria) { v.push(f.id_categoria); w.push(`p.id_categoria = $${v.length}`); }
  // El vendedor solo ve productos activos.
  if (usuario.rol !== 'administrador') w.push('p.estado');
  else if (f.estado !== undefined) { v.push(f.estado); w.push(`p.estado = $${v.length}`); }
  if (f.stock_estado === 'agotado') w.push('p.stock = 0');
  if (f.stock_estado === 'bajo') w.push('p.stock > 0 AND p.stock <= p.stock_minimo');
  if (f.stock_estado === 'normal') w.push('p.stock > p.stock_minimo');
  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const total = Number((await query(`SELECT count(*) FROM productos p ${where}`, v)).rows[0].count);
  const { rows } = await query(`${SEL} ${where} ORDER BY p.nombre, p.descripcion LIMIT ${p.porPagina} OFFSET ${p.offset}`, v);
  return respuestaPaginada(rows.map((r) => vista(r, usuario)), total, p);
}

export async function obtener(id, usuario = { rol: 'administrador' }) {
  const { rows } = await query(`${SEL} WHERE p.id_producto=$1`, [id]);
  if (!rows[0]) throw notFound('Producto no encontrado.');
  return vista(rows[0], usuario);
}

async function categoriaActiva(id_categoria, c) {
  const { rows } = await c.query('SELECT estado FROM categorias WHERE id_categoria=$1', [id_categoria]);
  if (!rows[0]) throw badRequest('La categoría indicada no existe.');
  if (!rows[0].estado) throw badRequest('La categoría está desactivada.');
}

export async function crear(d, actor) {
  return tx(async (c) => {
    await categoriaActiva(d.id_categoria, c);
    const { rows } = await c.query(
      `INSERT INTO productos (nombre, descripcion, costo, precio, stock, stock_minimo, id_categoria) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id_producto`,
      [d.nombre, d.descripcion, d.costo, d.precio, d.stock, d.stock_minimo, d.id_categoria]);
    const id = rows[0].id_producto;
    if (d.stock > 0) {
      await c.query(
        `INSERT INTO movimientos_inventario (id_producto, tipo_movimiento, cantidad, stock_resultante, motivo, id_usuario) VALUES ($1,'entrada',$2,$2,'Stock inicial',$3)`,
        [id, d.stock, actor.id_usuario]);
    }
    return id;
  }).then(obtener);
}

/** El stock NO se edita aquí: solo cambia mediante movimientos de inventario o ventas. */
export async function editar(id, d) {
  return tx(async (c) => {
    await categoriaActiva(d.id_categoria, c);
    const r = await c.query(
      `UPDATE productos SET nombre=$1, descripcion=$2, costo=$3, precio=$4, stock_minimo=$5, id_categoria=$6, actualizado_en=now() WHERE id_producto=$7`,
      [d.nombre, d.descripcion, d.costo, d.precio, d.stock_minimo, d.id_categoria, id]);
    if (!r.rowCount) throw notFound('Producto no encontrado.');
  }).then(() => obtener(id));
}

export async function cambiarEstado(id, estado) {
  const r = await query('UPDATE productos SET estado=$1, actualizado_en=now() WHERE id_producto=$2', [estado, id]);
  if (!r.rowCount) throw notFound('Producto no encontrado.');
  return obtener(id);
}
