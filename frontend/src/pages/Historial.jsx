import { useEffect, useState } from 'react';
import { Eye, Mic, MousePointerClick, Printer } from 'lucide-react';
import { api } from '../services/api.js';
import { useCarga, useDebounce } from '../hooks/useCarga.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Boton, Buscador, CabeceraPagina, Campo, Cargando, ErrorCarga, Insignia, Modal, Paginacion, Vacio } from '../components/ui.jsx';
import { dinero, fechaHora } from '../utils/format.js';

const PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia', otro: 'Otro' };

function Detalle({ id, onCerrar }) {
  const { datos: v, cargando, error, recargar } = useCarga(() => api.get(`/ventas/${id}`), [id]);
  const { esAdmin, config } = useAuth();
  return (
    <Modal titulo={`Venta #${id}`} onCerrar={onCerrar} ancho pie={<><Boton icono={Printer} onClick={() => window.print()}>Imprimir comprobante</Boton><Boton onClick={onCerrar}>Cerrar</Boton></>}>
      {cargando ? <Cargando /> : error ? <ErrorCarga mensaje={error} onReintentar={recargar} /> : (
        <div id="comprobante" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="solo-impresion"><h2>{config?.nombre_negocio || 'Comprobante de venta'}</h2><p>Comprobante de venta N.º {String(v.id_venta).padStart(8, '0')} — documento no tributario</p></div>
          <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, margin: 0 }}>
            <div><dt className="muted">Fecha</dt><dd style={{ margin: 0 }}>{fechaHora(v.fecha)}</dd></div>
            <div><dt className="muted">Vendedor</dt><dd style={{ margin: 0 }}>{v.vendedor}</dd></div>
            <div><dt className="muted">Cliente</dt><dd style={{ margin: 0 }}>{v.cliente || 'Consumidor final'}</dd></div>
            <div><dt className="muted">Pago</dt><dd style={{ margin: 0 }}>{PAGO[v.metodo_pago]}</dd></div>
            <div><dt className="muted">Canal</dt><dd style={{ margin: 0 }}>{v.canal === 'voz' ? 'Voz' : 'Manual'}</dd></div>
            {v.duracion_seg != null && <div><dt className="muted">Tiempo de registro</dt><dd style={{ margin: 0 }}>{v.duracion_seg} s</dd></div>}
          </dl>
          <div className="tabla-wrap"><table>
            <caption className="solo-lectores">Productos de la venta</caption>
            <thead><tr><th>Producto</th><th className="num">Cant.</th><th className="num">Precio</th><th className="num">Subtotal</th></tr></thead>
            <tbody>{v.detalle.map((d) => <tr key={d.id_detalle}><td>{d.nombre_producto}</td><td className="num">{d.cantidad}</td><td className="num">{dinero(d.precio_unitario)}</td><td className="num">{dinero(d.subtotal)}</td></tr>)}</tbody>
          </table></div>
          <div className="totales" style={{ maxWidth: 320, marginLeft: 'auto', width: '100%' }}>
            <div><span>Subtotal</span><span>{dinero(v.subtotal)}</span></div>
            <div><span>Impuesto ({Number(v.tasa_impuesto)}%)</span><span>{dinero(v.impuesto)}</span></div>
            <div className="total-final"><span>Total</span><span>{dinero(v.total)}</span></div>
          </div>
          {esAdmin && v.ganancia != null && <p className="muted no-imprimir">Ganancia de esta venta (sin impuesto, menos costo): <strong>{dinero(v.ganancia)}</strong></p>}
          <p className="solo-impresion">Gracias por su compra.</p>
        </div>
      )}
    </Modal>
  );
}

export default function Historial() {
  const { esAdmin } = useAuth();
  const [q, setQ] = useState(''); const [desde, setDesde] = useState(''); const [hasta, setHasta] = useState(''); const [canal, setCanal] = useState(''); const [vend, setVend] = useState(''); const [pagina, setPagina] = useState(1);
  const bq = useDebounce(q);
  const { datos, cargando, error, recargar } = useCarga(() => api.get('/ventas', { q: bq, desde, hasta, canal, id_usuario: esAdmin ? vend : '', pagina }), [bq, desde, hasta, canal, vend, pagina]);
  const [usuarios, setUsuarios] = useState([]);
  useEffect(() => { if (esAdmin) api.get('/usuarios', { por_pagina: 100 }).then((r) => setUsuarios(r.datos)).catch(() => {}); }, [esAdmin]);
  const [ver, setVer] = useState(null);
  const reset = (fn) => (e) => { fn(e.target.value); setPagina(1); };
  return (
    <>
      <CabeceraPagina titulo="Historial de ventas" descripcion={esAdmin ? 'Todas las ventas. Las ventas registradas no se pueden editar ni eliminar.' : 'Tus ventas registradas.'} />
      <div className="filtros">
        <Buscador valor={q} onChange={(v) => { setQ(v); setPagina(1); }} etiqueta="Buscar venta" placeholder="N.º de venta o cliente…" />
        <Campo etiqueta="Desde">{(p) => <input {...p} type="date" value={desde} max={hasta || undefined} onChange={reset(setDesde)} />}</Campo>
        <Campo etiqueta="Hasta">{(p) => <input {...p} type="date" value={hasta} min={desde || undefined} onChange={reset(setHasta)} />}</Campo>
        <Campo etiqueta="Canal">{(p) => <select {...p} value={canal} onChange={reset(setCanal)}><option value="">Todos</option><option value="manual">Manual</option><option value="voz">Voz</option></select>}</Campo>
        {esAdmin && <Campo etiqueta="Vendedor">{(p) => <select {...p} value={vend} onChange={reset(setVend)}><option value="">Todos</option>{usuarios.map((u) => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre} {u.apellido}</option>)}</select>}</Campo>}
      </div>
      {cargando ? <Cargando /> : error ? <ErrorCarga mensaje={error} onReintentar={recargar} /> : datos.datos.length === 0 ? <Vacio texto="No hay ventas con esos filtros." /> : (
        <div className="tabla-wrap"><table>
          <caption className="solo-lectores">Historial de ventas</caption>
          <thead><tr><th>N.º</th><th>Fecha</th>{esAdmin && <th>Vendedor</th>}<th>Cliente</th><th>Canal</th><th>Pago</th><th className="num">Unid.</th><th className="num">Total</th><th>Detalle</th></tr></thead>
          <tbody>{datos.datos.map((v) => (
            <tr key={v.id_venta}>
              <td>#{v.id_venta}</td><td>{fechaHora(v.fecha)}</td>{esAdmin && <td>{v.vendedor}</td>}<td>{v.cliente || 'Consumidor final'}</td>
              <td><Insignia tipo={v.canal === 'voz' ? 'info' : 'neutro'}>{v.canal === 'voz' ? <Mic size={14} aria-hidden="true" /> : <MousePointerClick size={14} aria-hidden="true" />}{v.canal === 'voz' ? 'Voz' : 'Manual'}</Insignia></td>
              <td>{PAGO[v.metodo_pago]}</td><td className="num">{v.unidades}</td><td className="num"><strong>{dinero(v.total)}</strong></td>
              <td><Boton peq icono={Eye} onClick={() => setVer(v.id_venta)} aria-label={`Ver detalle de la venta ${v.id_venta}`}>Ver</Boton></td>
            </tr>))}</tbody>
        </table></div>
      )}
      {datos && <Paginacion pag={datos.paginacion} onCambiar={setPagina} />}
      {ver && <Detalle id={ver} onCerrar={() => setVer(null)} />}
    </>
  );
}
