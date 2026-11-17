import { useEffect, useState } from 'react';
import { Plus, Pencil, Power } from 'lucide-react';
import { api } from '../services/api.js';
import { useCarga, useDebounce } from '../hooks/useCarga.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Aviso, Boton, Buscador, CabeceraPagina, Campo, Cargando, Confirmar, ErrorCarga, EstadoInsignia, Modal, Paginacion, StockInsignia, Vacio, erroresDeCampos } from '../components/ui.jsx';
import { dinero } from '../utils/format.js';

function Formulario({ prod, categorias, onCerrar, onGuardado }) {
  const toast = useToast();
  const [f, setF] = useState({
    nombre: prod?.nombre ?? '', descripcion: prod?.descripcion ?? '', costo: prod?.costo ?? '', precio: prod?.precio ?? '', stock: 0, stock_minimo: prod?.stock_minimo ?? 0,
    id_categoria: prod?.id_categoria ?? categorias[0]?.id_categoria ?? '',
  });
  const [err, setErr] = useState({}); const [msg, setMsg] = useState(''); const [cargando, setCargando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function guardar(e) {
    e.preventDefault(); setCargando(true); setErr({}); setMsg('');
    const cuerpo = { ...f, costo: f.costo === '' ? 0 : Number(f.costo), precio: f.precio === '' ? undefined : Number(f.precio), stock_minimo: Number(f.stock_minimo), id_categoria: Number(f.id_categoria) };
    if (prod) delete cuerpo.stock; else cuerpo.stock = Number(f.stock);
    try {
      prod ? await api.put(`/productos/${prod.id_producto}`, cuerpo) : await api.post('/productos', cuerpo);
      toast.exito(prod ? 'Producto actualizado.' : 'Producto creado.'); onGuardado();
    } catch (x) { setErr(erroresDeCampos(x)); setMsg(x.message); } finally { setCargando(false); }
  }
  return (
    <Modal titulo={prod ? 'Editar producto' : 'Nuevo producto'} onCerrar={onCerrar}
      pie={<><Boton onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" cargando={cargando} onClick={guardar}>Guardar</Boton></>}>
      <form onSubmit={guardar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {msg && <Aviso tipo="error">{msg}</Aviso>}
        <div className="fila-form">
          <Campo etiqueta="Nombre" requerido error={err.nombre}>{(p) => <input {...p} value={f.nombre} maxLength={100} onChange={set('nombre')} />}</Campo>
          <Campo etiqueta="Descripción / presentación" error={err.descripcion} ayuda="Ej.: Botella 500 ml">{(p) => <input {...p} value={f.descripcion} maxLength={150} onChange={set('descripcion')} />}</Campo>
          <Campo etiqueta="Costo de compra (USD)" error={err.costo} ayuda="Lo que te cobra el proveedor por unidad.">{(p) => <input {...p} type="number" inputMode="decimal" min="0" step="0.01" value={f.costo} onChange={set('costo')} />}</Campo>
          <Campo etiqueta="Precio de venta (USD)" requerido error={err.precio} ayuda={f.precio !== '' && Number(f.precio) > 0 ? `Ganancia por unidad: ${dinero(Number(f.precio) - Number(f.costo || 0))} (${Math.round(((Number(f.precio) - Number(f.costo || 0)) / Number(f.precio)) * 100)} %)` : undefined}>{(p) => <input {...p} type="number" inputMode="decimal" min="0" step="0.01" value={f.precio} onChange={set('precio')} />}</Campo>
          <Campo etiqueta="Categoría" requerido error={err.id_categoria}>{(p) => <select {...p} value={f.id_categoria} onChange={set('id_categoria')}>{categorias.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}</select>}</Campo>
          {!prod && <Campo etiqueta="Stock inicial" error={err.stock}>{(p) => <input {...p} type="number" inputMode="numeric" min="0" step="1" value={f.stock} onChange={set('stock')} />}</Campo>}
          <Campo etiqueta="Stock mínimo (alerta)" error={err.stock_minimo}>{(p) => <input {...p} type="number" inputMode="numeric" min="0" step="1" value={f.stock_minimo} onChange={set('stock_minimo')} />}</Campo>
        </div>
        {prod && <Aviso tipo="info">El stock no se edita aquí. Usa <strong>Inventario</strong> para registrar entradas, salidas o ajustes con su motivo.</Aviso>}
      </form>
    </Modal>
  );
}

export default function Productos() {
  const { esAdmin } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [estado, setEstado] = useState(''); const [stockEstado, setStockEstado] = useState(''); const [pagina, setPagina] = useState(1);
  const bq = useDebounce(q);
  const { datos, cargando, error, recargar } = useCarga(() => api.get('/productos', { q: bq, id_categoria: cat, estado: esAdmin ? estado : '', stock_estado: stockEstado, pagina }), [bq, cat, estado, stockEstado, pagina]);
  const [categorias, setCategorias] = useState([]);
  useEffect(() => { api.get('/categorias', { por_pagina: 100, estado: esAdmin ? undefined : true }).then((r) => setCategorias(r.datos)).catch(() => {}); }, [esAdmin]);
  const [edit, setEdit] = useState(undefined); const [cambio, setCambio] = useState(null); const [trabajando, setTrabajando] = useState(false);

  async function alternar() {
    setTrabajando(true);
    try { await api.patch(`/productos/${cambio.id_producto}/estado`, { estado: !cambio.estado }); toast.exito('Estado actualizado.'); setCambio(null); recargar(); }
    catch (e) { toast.error(e.message); setCambio(null); } finally { setTrabajando(false); }
  }
  const reset = (fn) => (e) => { fn(e.target.value); setPagina(1); };
  return (
    <>
      <CabeceraPagina titulo="Productos" descripcion={esAdmin ? 'Catálogo, precios y estado de cada producto.' : 'Consulta precios y existencias.'}>
        {esAdmin && <Boton variante="primario" icono={Plus} onClick={() => setEdit(null)} disabled={!categorias.some((c) => c.estado)}>Nuevo producto</Boton>}
      </CabeceraPagina>
      <div className="filtros">
        <Buscador valor={q} onChange={(v) => { setQ(v); setPagina(1); }} etiqueta="Buscar producto" placeholder="Buscar por nombre…" />
        <Campo etiqueta="Categoría">{(p) => <select {...p} value={cat} onChange={reset(setCat)}><option value="">Todas</option>{categorias.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}</select>}</Campo>
        <Campo etiqueta="Existencias">{(p) => <select {...p} value={stockEstado} onChange={reset(setStockEstado)}><option value="">Todas</option><option value="normal">Disponible</option><option value="bajo">Stock bajo</option><option value="agotado">Agotado</option></select>}</Campo>
        {esAdmin && <Campo etiqueta="Estado">{(p) => <select {...p} value={estado} onChange={reset(setEstado)}><option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option></select>}</Campo>}
      </div>
      {cargando ? <Cargando /> : error ? <ErrorCarga mensaje={error} onReintentar={recargar} /> : datos.datos.length === 0 ? <Vacio texto="No hay productos con esos filtros." /> : (
        <div className="tabla-wrap"><table>
          <caption className="solo-lectores">Lista de productos</caption>
          <thead><tr><th>Producto</th><th>Categoría</th><th className="num">Precio</th>{esAdmin && <><th className="num">Costo</th><th className="num">Ganancia/u.</th></>}<th className="num">Stock</th><th>Existencias</th>{esAdmin && <><th>Estado</th><th>Acciones</th></>}</tr></thead>
          <tbody>{datos.datos.map((p) => (
            <tr key={p.id_producto}>
              <td><strong>{p.nombre}</strong><div className="muted">{p.descripcion}</div></td><td>{p.categoria}</td>
              <td className="num">{dinero(p.precio)}</td>{esAdmin && <><td className="num">{dinero(p.costo)}</td><td className="num">{dinero(Number(p.precio) - Number(p.costo))}</td></>}<td className="num">{p.stock}</td><td><StockInsignia estado={p.stock_estado} /></td>
              {esAdmin && <>
                <td><EstadoInsignia activo={p.estado} /></td>
                <td><div className="acciones">
                  <Boton peq icono={Pencil} onClick={() => setEdit(p)} aria-label={`Editar ${p.nombre}`}>Editar</Boton>
                  <Boton peq icono={Power} onClick={() => setCambio(p)} aria-label={`${p.estado ? 'Desactivar' : 'Activar'} ${p.nombre}`}>{p.estado ? 'Desactivar' : 'Activar'}</Boton>
                </div></td></>}
            </tr>))}</tbody>
        </table></div>
      )}
      {datos && <Paginacion pag={datos.paginacion} onCambiar={setPagina} />}
      {edit !== undefined && <Formulario prod={edit} categorias={categorias.filter((c) => c.estado || c.id_categoria === edit?.id_categoria)} onCerrar={() => setEdit(undefined)} onGuardado={() => { setEdit(undefined); recargar(); }} />}
      {cambio && <Confirmar titulo={cambio.estado ? 'Desactivar producto' : 'Activar producto'} mensaje={cambio.estado ? `"${cambio.nombre}" dejará de poder venderse. Las ventas anteriores no cambian.` : `¿Activar "${cambio.nombre}"?`} peligro={cambio.estado} cargando={trabajando} onOk={alternar} onCancelar={() => setCambio(null)} />}
    </>
  );
}
