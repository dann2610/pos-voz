import { useState } from 'react';
import { Download } from 'lucide-react';
import { api } from '../services/api.js';
import { useCarga } from '../hooks/useCarga.js';
import { useToast } from '../context/ToastContext.jsx';
import { Aviso, Boton, CabeceraPagina, Campo, Cargando, ErrorCarga, Vacio } from '../components/ui.jsx';
import { BarrasHorizontales, BarrasVerticales } from '../components/Graficos.jsx';
import { dinero, etiquetaDia, hace, hoyISO } from '../utils/format.js';

const PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia', otro: 'Otro' };

export default function Reportes() {
  const toast = useToast();
  const [desde, setDesde] = useState(hace(29)); const [hasta, setHasta] = useState(hoyISO()); const [agrupar, setAgrupar] = useState('dia');
  const [bajando, setBajando] = useState(false);
  const { datos, cargando, error, recargar } = useCarga(async () => {
    const f = { desde, hasta, agrupar };
    const [ventas, top, vend, pagos, inv, voz] = await Promise.all([
      api.get('/reportes/ventas', f), api.get('/reportes/productos-top', { desde, hasta, limite: 8 }), api.get('/reportes/vendedores', { desde, hasta }),
      api.get('/reportes/metodos-pago', { desde, hasta }), api.get('/reportes/inventario'), api.get('/reportes/voz', { desde, hasta }),
    ]);
    return { ventas: ventas.datos, top: top.datos, vend: vend.datos, pagos: pagos.datos, inv, voz };
  }, [desde, hasta, agrupar]);

  async function csv() {
    setBajando(true);
    try {
      const blob = await api.descargar('/reportes/ventas.csv', { desde, hasta });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `ventas_${desde || 'inicio'}_${hasta || 'hoy'}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error(e.message); } finally { setBajando(false); }
  }
  const totalPeriodo = datos?.ventas.reduce((a, v) => a + Number(v.total), 0) ?? 0;
  const gananciaPeriodo = datos?.ventas.reduce((a, v) => a + Number(v.ganancia), 0) ?? 0;
  const subtotalPeriodo = datos?.ventas.reduce((a, v) => a + Number(v.subtotal), 0) ?? 0;
  const nVentas = datos?.ventas.reduce((a, v) => a + v.ventas, 0) ?? 0;
  const etiqueta = (p) => (agrupar === 'mes' ? p.slice(0, 7) : etiquetaDia(p));
  const manual = datos?.voz.canales.find((c) => c.canal === 'manual'); const voz = datos?.voz.canales.find((c) => c.canal === 'voz');
  const ped = Object.fromEntries((datos?.voz.pedidos_voz ?? []).map((p) => [p.estado, p.pedidos]));
  const totalPed = Object.values(ped).reduce((a, b) => a + b, 0);
  return (
    <>
      <CabeceraPagina titulo="Reportes" descripcion="Calculados en vivo con las ventas registradas.">
        <Boton icono={Download} cargando={bajando} onClick={csv}>Descargar ventas (CSV)</Boton>
      </CabeceraPagina>
      <div className="filtros">
        <Campo etiqueta="Desde">{(p) => <input {...p} type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />}</Campo>
        <Campo etiqueta="Hasta">{(p) => <input {...p} type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />}</Campo>
        <Campo etiqueta="Agrupar ventas por">{(p) => <select {...p} value={agrupar} onChange={(e) => setAgrupar(e.target.value)}><option value="dia">Día</option><option value="semana">Semana</option><option value="mes">Mes</option></select>}</Campo>
      </div>
      {cargando ? <Cargando /> : error ? <ErrorCarga mensaje={error} onReintentar={recargar} /> : (
        <>
          <div className="rejilla rejilla-2">
          <section className="tarjeta" aria-labelledby="r-ventas">
            <h2 id="r-ventas">Ventas por período — {dinero(totalPeriodo)} en {nVentas} venta(s)</h2>
            <div className="totales" style={{ maxWidth: 420 }}>
              <div><span>Ganancia del período</span><strong>{dinero(gananciaPeriodo)}</strong></div>
              <div><span>Margen sobre ventas (sin impuesto)</span><strong>{subtotalPeriodo > 0 ? `${Math.round((gananciaPeriodo / subtotalPeriodo) * 100)} %` : '—'}</strong></div>
            </div>
            {datos.ventas.length === 0 ? <Vacio texto="No hay ventas en este rango." /> : <BarrasVerticales datos={datos.ventas.map((v) => ({ etiqueta: etiqueta(v.periodo), valor: Number(v.total) }))} titulo="Ventas por período (USD)" formato={(v) => dinero(v)} />}
          </section>
          <section className="tarjeta" aria-labelledby="r-gan"><h2 id="r-gan">Ganancia por período</h2>
            {datos.ventas.length === 0 ? <Vacio texto="No hay ventas en este rango." /> : <BarrasVerticales datos={datos.ventas.map((v) => ({ etiqueta: etiqueta(v.periodo), valor: Number(v.ganancia) }))} titulo="Ganancia por período (USD)" formato={(v) => dinero(v)} />}
          </section>
          </div>
          <div className="rejilla rejilla-2">
            <section className="tarjeta" aria-labelledby="r-top"><h2 id="r-top">Productos más vendidos</h2>
              {datos.top.length === 0 ? <p className="muted">Sin datos.</p> : <BarrasHorizontales datos={datos.top.map((p) => ({ etiqueta: p.nombre, valor: p.unidades }))} titulo="Unidades vendidas" formato={(v) => `${v} u.`} />}</section>
            <section className="tarjeta" aria-labelledby="r-topg"><h2 id="r-topg">Productos que más ganancia dejan</h2>
              {datos.top.length === 0 ? <p className="muted">Sin datos.</p> : <BarrasHorizontales datos={[...datos.top].sort((a, b) => Number(b.ganancia) - Number(a.ganancia)).map((p) => ({ etiqueta: p.nombre, valor: Number(p.ganancia) }))} titulo="Ganancia por producto (USD)" formato={(v) => dinero(v)} />}</section>
            <section className="tarjeta" aria-labelledby="r-vend"><h2 id="r-vend">Ventas por vendedor</h2>
              {datos.vend.length === 0 ? <p className="muted">Sin datos.</p> : <BarrasHorizontales datos={datos.vend.map((p) => ({ etiqueta: p.vendedor, valor: Number(p.total) }))} titulo="Ventas por vendedor (USD)" formato={(v) => dinero(v)} />}</section>
            <section className="tarjeta" aria-labelledby="r-pago"><h2 id="r-pago">Métodos de pago</h2>
              {datos.pagos.length === 0 ? <p className="muted">Sin datos.</p> : <BarrasHorizontales datos={datos.pagos.map((p) => ({ etiqueta: PAGO[p.metodo_pago], valor: Number(p.total) }))} titulo="Ventas por método de pago (USD)" formato={(v) => dinero(v)} />}</section>
          </div>
            <section className="tarjeta" aria-labelledby="r-inv"><h2 id="r-inv">Inventario</h2>
              <div className="totales totales-rejilla"><div><span>Productos activos</span><strong>{datos.inv.productos_activos}</strong></div><div><span>Unidades en stock</span><strong>{datos.inv.unidades_totales}</strong></div><div><span>Valor a costo (lo que pagaste)</span><strong>{dinero(datos.inv.valor_a_costo)}</strong></div><div><span>Valor a precio de venta</span><strong>{dinero(datos.inv.valor_a_precio_venta)}</strong></div><div><span>Ganancia potencial</span><strong>{dinero(datos.inv.ganancia_potencial)}</strong></div><div><span>Agotados</span><strong>{datos.inv.agotados}</strong></div><div><span>Con stock bajo</span><strong>{datos.inv.bajos}</strong></div></div></section>
          <section className="tarjeta" aria-labelledby="r-voz"><h2 id="r-voz">Indicadores de la interacción por voz</h2>
            <div className="tabla-wrap"><table>
              <caption className="solo-lectores">Comparación entre canal manual y canal de voz</caption>
              <thead><tr><th>Canal</th><th className="num">Ventas</th><th className="num">Con tiempo medido</th><th className="num">Tiempo medio de registro</th></tr></thead>
              <tbody>{[['Manual', manual], ['Voz', voz]].map(([n, c]) => <tr key={n}><td>{n}</td><td className="num">{c?.ventas ?? 0}</td><td className="num">{c?.ventas_con_tiempo ?? 0}</td><td className="num">{c?.duracion_media_seg != null ? `${c.duracion_media_seg} s` : '—'}</td></tr>)}</tbody>
            </table></div>
            <p style={{ marginTop: 12 }}>Pedidos dictados en el período: <strong>{totalPed}</strong> (confirmados {ped.confirmado ?? 0}, cancelados {ped.cancelado ?? 0}, caducados {ped.caducado ?? 0}, pendientes {ped.pendiente ?? 0}).</p>
            <Aviso tipo="info" style={{ marginTop: 12 }}>El tiempo de registro es medido por el propio sistema (del primer producto o la primera orden hasta registrar la venta). El WER, la tasa de interpretación y el SUS requieren sesiones de prueba con usuarios reales y se calculan con los scripts de <code>backend/scripts</code>; aquí no se muestran valores inventados.</Aviso>
          </section>
        </>
      )}
    </>
  );
}
