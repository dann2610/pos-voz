import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from 'lucide-react';
import { api } from '../services/api.js';
import { useCarga } from '../hooks/useCarga.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Download } from 'lucide-react';
import { Aviso, Boton, Buscador, CabeceraPagina, Campo, Cargando, ErrorCarga, Insignia, Modal, Paginacion, Pestanas, Vacio, erroresDeCampos } from '../components/ui.jsx';
import { dinero, fechaHora } from '../utils/format.js';

const TIPOS = { entrada: ['ok', 'Entrada'], salida: ['peligro', 'Salida'], ajuste: ['info', 'Ajuste'] };

function FormMovimiento({ productos, inicial, onCerrar, onGuardado }) {
  const toast = useToast();
  const [f, setF] = useState({ tipo_movimiento: inicial?.tipo ?? 'entrada', id_producto: inicial?.id_producto ?? productos[0]?.id_producto ?? '', cantidad: '', nuevo_stock: '', motivo: '' });
  const [err, setErr] = useState({}); const [msg, setMsg] = useState(''); const [cargando, setCargando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const prod = productos.find((p) => p.id_producto === Number(f.id_producto));
  async function guardar(e) {
    e.preventDefault(); setCargando(true); setErr({}); setMsg('');
    const cuerpo = { tipo_movimiento: f.tipo_movimiento, id_producto: Number(f.id_producto), motivo: f.motivo };
    if (f.tipo_movimiento === 'ajuste') cuerpo.nuevo_stock = f.nuevo_stock === '' ? undefined : Number(f.nuevo_stock);
    else cuerpo.cantidad = f.cantidad === '' ? undefined : Number(f.cantidad);
    try { const r = await api.post('/inventario/movimientos', cuerpo); toast.exito(`${r.producto}: stock actual ${r.stock_resultante}.`); onGuardado(); }
    catch (x) { setErr(erroresDeCampos(x)); setMsg(x.message); } finally { setCargando(false); }
  }
  return (
    <Modal titulo="Registrar movimiento de inventario" onCerrar={onCerrar}
      pie={<><Boton onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" cargando={cargando} onClick={guardar}>Registrar</Boton></>}>
      <form onSubmit={guardar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {msg && <Aviso tipo="error">{msg}</Aviso>}
        <div className="fila-form">
          <Campo etiqueta="Tipo" requerido>{(p) => <select {...p} value={f.tipo_movimiento} onChange={set('tipo_movimiento')}><option value="entrada">Entrada (compra, reposición)</option><option value="salida">Salida (merma, daño)</option><option value="ajuste">Ajuste (conteo físico)</option></select>}</Campo>
          <Campo etiqueta="Producto" requerido error={err.id_producto}>{(p) => <select {...p} value={f.id_producto} onChange={set('id_producto')}>{productos.map((x) => <option key={x.id_producto} value={x.id_producto}>{x.nombre}{x.descripcion ? ` — ${x.descripcion}` : ''}</option>)}</select>}</Campo>
          {f.tipo_movimiento === 'ajuste'
            ? <Campo etiqueta="Nuevo stock" requerido error={err.nuevo_stock} ayuda={prod ? `Stock actual: ${prod.stock}` : undefined}>{(p) => <input {...p} type="number" inputMode="numeric" min="0" step="1" value={f.nuevo_stock} onChange={set('nuevo_stock')} />}</Campo>
            : <Campo etiqueta="Cantidad" requerido error={err.cantidad} ayuda={prod ? `Stock actual: ${prod.stock}` : undefined}>{(p) => <input {...p} type="number" inputMode="numeric" min="1" step="1" value={f.cantidad} onChange={set('cantidad')} />}</Campo>}
        </div>
        <Campo etiqueta="Motivo" requerido error={err.motivo} ayuda="Queda registrado en el historial.">{(p) => <input {...p} maxLength={150} value={f.motivo} onChange={set('motivo')} />}</Campo>
      </form>
    </Modal>
  );
}

function Alertas({ recargarClave, onMover, esAdmin }) {
  const { datos, cargando, error, recargar } = useCarga(() => api.get('/inventario/alertas'), [recargarClave]);
  if (cargando) return <Cargando />;
  if (error) return <ErrorCarga mensaje={error} onReintentar={recargar} />;
  if (!datos.datos.length) return <Aviso tipo="ok">Todo en orden: no hay productos agotados ni por debajo del mínimo.</Aviso>;
  return (
    <div className="tabla-wrap"><table>
      <caption className="solo-lectores">Productos con stock bajo o agotados</caption>
      <thead><tr><th>Producto</th><th>Categoría</th><th className="num">Stock</th><th className="num">Mínimo</th><th>Nivel</th>{esAdmin && <th>Acción</th>}</tr></thead>
      <tbody>{datos.datos.map((a) => (
        <tr key={a.id_producto}>
          <td><strong>{a.nombre}</strong><div className="muted">{a.descripcion}</div></td><td>{a.categoria}</td><td className="num">{a.stock}</td><td className="num">{a.stock_minimo}</td>
          <td><Insignia tipo={a.nivel === 'agotado' ? 'peligro' : 'warn'}>{a.nivel === 'agotado' ? 'Agotado' : 'Stock bajo'}</Insignia></td>
          {esAdmin && <td><Boton peq icono={ArrowDownToLine} onClick={() => onMover({ tipo: 'entrada', id_producto: a.id_producto })} aria-label={`Registrar entrada de ${a.nombre}`}>Reponer</Boton></td>}
        </tr>))}</tbody>
    </table></div>
  );
}

function Movimientos({ recargarClave }) {
  const [pagina, setPagina] = useState(1); const [tipo, setTipo] = useState('');
  const { datos, cargando, error, recargar } = useCarga(() => api.get('/inventario/movimientos', { pagina, tipo }), [pagina, tipo, recargarClave]);
  return (
    <>
      <div className="filtros"><Campo etiqueta="Tipo de movimiento">{(p) => <select {...p} value={tipo} onChange={(e) => { setTipo(e.target.value); setPagina(1); }}><option value="">Todos</option><option value="entrada">Entradas</option><option value="salida">Salidas</option><option value="ajuste">Ajustes</option></select>}</Campo></div>
      {cargando ? <Cargando /> : error ? <ErrorCarga mensaje={error} onReintentar={recargar} /> : datos.datos.length === 0 ? <Vacio texto="No hay movimientos." /> : (
        <div className="tabla-wrap"><table>
          <caption className="solo-lectores">Historial de movimientos de inventario</caption>
          <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th className="num">Cantidad</th><th className="num">Stock resultante</th><th>Motivo</th><th>Usuario</th></tr></thead>
          <tbody>{datos.datos.map((m) => (
            <tr key={m.id_movimiento}>
              <td>{fechaHora(m.fecha)}</td><td>{m.producto}</td><td><Insignia tipo={TIPOS[m.tipo_movimiento][0]}>{TIPOS[m.tipo_movimiento][1]}</Insignia></td>
              <td className="num">{m.cantidad}</td><td className="num">{m.stock_resultante}</td><td>{m.motivo}</td><td>{m.usuario}</td>
            </tr>))}</tbody>
        </table></div>
      )}
      {datos && <Paginacion pag={datos.paginacion} onCambiar={setPagina} />}
    </>
  );
}

function Valorado() {
  const toast = useToast();
  const { datos, cargando, error, recargar } = useCarga(() => api.get('/reportes/inventario-detalle'), []);
  const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [est, setEst] = useState(''); const [bajando, setBajando] = useState(false);
  if (cargando) return <Cargando />;
  if (error) return <ErrorCarga mensaje={error} onReintentar={recargar} />;
  const todas = datos.datos;
  const categorias = [...new Set(todas.map((p) => p.categoria))];
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const filas = todas.filter((p) => (!cat || p.categoria === cat) && (!est || p.stock_estado === est) && (!q || norm(`${p.nombre} ${p.descripcion}`).includes(norm(q))));
  const suma = (k) => filas.reduce((a, p) => a + Number(p[k]), 0);
  async function bajar() {
    setBajando(true);
    try {
      const blob = await api.descargar('/reportes/inventario.csv');
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'inventario.csv'; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error(e.message); } finally { setBajando(false); }
  }
  return (
    <>
      <div className="rejilla rejilla-kpi">
        <div className="tarjeta kpi"><span className="etiqueta">Productos mostrados</span><span className="valor">{filas.length}</span><span className="sub">{suma('stock')} unidades en stock</span></div>
        <div className="tarjeta kpi"><span className="etiqueta">Valor a costo</span><span className="valor">{dinero(suma('valor_costo'))}</span><span className="sub">Lo que pagaste por lo que tienes</span></div>
        <div className="tarjeta kpi"><span className="etiqueta">Valor a precio de venta</span><span className="valor">{dinero(suma('valor_venta'))}</span><span className="sub">Ganancia potencial {dinero(suma('valor_venta') - suma('valor_costo'))}</span></div>
      </div>
      <div className="filtros">
        <Buscador valor={q} onChange={setQ} etiqueta="Buscar en el inventario" placeholder="Buscar producto…" />
        <Campo etiqueta="Categoría">{(p) => <select {...p} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Todas</option>{categorias.map((c) => <option key={c}>{c}</option>)}</select>}</Campo>
        <Campo etiqueta="Existencias">{(p) => <select {...p} value={est} onChange={(e) => setEst(e.target.value)}><option value="">Todas</option><option value="normal">Disponible</option><option value="bajo">Stock bajo</option><option value="agotado">Agotado</option></select>}</Campo>
        <Boton icono={Download} cargando={bajando} onClick={bajar}>Descargar (Excel/CSV)</Boton>
      </div>
      {filas.length === 0 ? <Vacio texto="No hay productos con esos filtros." /> : (
        <div className="tabla-wrap"><table>
          <caption className="solo-lectores">Inventario valorado</caption>
          <thead><tr><th>Producto</th><th>Categoría</th><th className="num">Stock</th><th className="num">Costo</th><th className="num">Precio</th><th className="num">Margen</th><th className="num">Valor a costo</th><th className="num">Valor a venta</th><th>Estado</th></tr></thead>
          <tbody>{filas.map((p) => (
            <tr key={p.id_producto}>
              <td><strong>{p.nombre}</strong><div className="muted">{p.descripcion}</div></td><td>{p.categoria}</td>
              <td className="num">{p.stock}</td><td className="num">{dinero(p.costo)}</td><td className="num">{dinero(p.precio)}</td><td className="num">{p.margen_pct} %</td>
              <td className="num">{dinero(p.valor_costo)}</td><td className="num">{dinero(p.valor_venta)}</td>
              <td><Insignia tipo={p.stock_estado === 'agotado' ? 'peligro' : p.stock_estado === 'bajo' ? 'warn' : 'ok'}>{p.stock_estado === 'agotado' ? 'Agotado' : p.stock_estado === 'bajo' ? 'Stock bajo' : 'Disponible'}</Insignia></td>
            </tr>))}</tbody>
        </table></div>
      )}
    </>
  );
}

export default function Inventario() {
  const { esAdmin } = useAuth();
  const [tab, setTab] = useState('alertas');
  const [clave, setClave] = useState(0);
  const [form, setForm] = useState(null);
  const [productos, setProductos] = useState([]);
  useEffect(() => { if (esAdmin) api.get('/productos', { por_pagina: 100, estado: true }).then((r) => setProductos(r.datos)).catch(() => {}); }, [esAdmin, clave]);
  const opciones = esAdmin ? [{ id: 'alertas', texto: 'Alertas de stock' }, { id: 'valorado', texto: 'Inventario valorado' }, { id: 'movs', texto: 'Movimientos' }] : [{ id: 'alertas', texto: 'Alertas de stock' }];
  return (
    <>
      <CabeceraPagina titulo="Inventario" descripcion={esAdmin ? 'Entradas, salidas y ajustes con motivo; las ventas descuentan stock automáticamente.' : 'Productos agotados o con stock bajo.'}>
        {esAdmin && <>
          <Boton variante="primario" icono={ArrowDownToLine} onClick={() => setForm({ tipo: 'entrada' })} disabled={!productos.length}>Entrada</Boton>
          <Boton icono={ArrowUpFromLine} onClick={() => setForm({ tipo: 'salida' })} disabled={!productos.length}>Salida</Boton>
          <Boton icono={SlidersHorizontal} onClick={() => setForm({ tipo: 'ajuste' })} disabled={!productos.length}>Ajuste</Boton>
        </>}
      </CabeceraPagina>
      <Pestanas valor={tab} onChange={setTab} opciones={opciones} etiqueta="Secciones de inventario" />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'alertas' ? <Alertas recargarClave={clave} esAdmin={esAdmin} onMover={setForm} /> : tab === 'valorado' ? <Valorado key={clave} /> : <Movimientos recargarClave={clave} />}
      </div>
      {form && <FormMovimiento productos={productos} inicial={form} onCerrar={() => setForm(null)} onGuardado={() => { setForm(null); setClave((c) => c + 1); }} />}
    </>
  );
}
