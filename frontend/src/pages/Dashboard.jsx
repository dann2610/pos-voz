import { Link } from 'react-router-dom';
import { AlertTriangle, Banknote, CalendarDays, Package, PiggyBank, ShoppingCart, Users, Warehouse } from 'lucide-react';
import { api } from '../services/api.js';
import { useCarga } from '../hooks/useCarga.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Cargando, ErrorCarga, CabeceraPagina, Insignia } from '../components/ui.jsx';
import { BarrasHorizontales, BarrasVerticales, serieDias } from '../components/Graficos.jsx';
import { dinero } from '../utils/format.js';

function Kpi({ icono: I, etiqueta, valor, sub }) {
  return <div className="tarjeta kpi"><span className="etiqueta"><I size={18} aria-hidden="true" />{etiqueta}</span><span className="valor">{valor}</span>{sub && <span className="sub">{sub}</span>}</div>;
}

export default function Dashboard() {
  const { usuario, esAdmin, config } = useAuth();
  const { datos: d, cargando, error, recargar } = useCarga(() => api.get('/dashboard'), []);
  if (cargando) return <Cargando />;
  if (error) return <ErrorCarga mensaje={error} onReintentar={recargar} />;
  const alertas = d.alertas.agotados + d.alertas.bajos;
  return (
    <>
      <CabeceraPagina titulo={`Hola, ${usuario.nombre}`} descripcion={`${config?.nombre_negocio ?? ''} · ${esAdmin ? 'Resumen general del negocio' : 'Tu resumen de ventas'}`}>
        <Link to="/vender" className="btn btn-primario btn-grande"><ShoppingCart size={22} aria-hidden="true" />Nueva venta</Link>
      </CabeceraPagina>
      <div className="rejilla rejilla-kpi">
        <Kpi icono={Banknote} etiqueta="Ventas de hoy" valor={dinero(d.hoy.total)} sub={`${d.hoy.ventas} venta(s)`} />
        <Kpi icono={CalendarDays} etiqueta="Ventas del mes" valor={dinero(d.mes.total)} sub={`${d.mes.ventas} venta(s)`} />
        <Kpi icono={AlertTriangle} etiqueta="Alertas de stock" valor={alertas} sub={`${d.alertas.agotados} agotado(s) · ${d.alertas.bajos} con stock bajo`} />
        {esAdmin && <Kpi icono={Package} etiqueta="Productos activos" valor={d.productos_activos} sub={`${d.clientes_activos} clientes · ${d.usuarios_activos} usuarios`} />}
      </div>
      {esAdmin && (
        <div className="rejilla rejilla-kpi">
          <Kpi icono={PiggyBank} etiqueta="Ganancia de hoy" valor={dinero(d.hoy.ganancia)} sub="Ventas sin impuesto menos costo de compra" />
          <Kpi icono={PiggyBank} etiqueta="Ganancia del mes" valor={dinero(d.mes.ganancia)} sub="Ventas sin impuesto menos costo de compra" />
          <Kpi icono={Warehouse} etiqueta="Inventario a costo" valor={dinero(d.inventario.valor_a_costo)} sub={`${d.inventario.unidades_totales} unidades · a precio de venta ${dinero(d.inventario.valor_a_precio_venta)}`} />
          <Kpi icono={Warehouse} etiqueta="Ganancia potencial en stock" valor={dinero(d.inventario.ganancia_potencial)} sub="Si se vendiera todo el inventario" />
        </div>
      )}
      <div className="rejilla rejilla-2">
        <section className="tarjeta" aria-labelledby="h-7d">
          <h2 id="h-7d">Ventas de los últimos 7 días</h2>
          <BarrasVerticales datos={serieDias(d.ultimos_7_dias)} titulo="Ventas por día (USD), últimos 7 días" formato={(v) => dinero(v)} />
        </section>
        <section className="tarjeta" aria-labelledby="h-top">
          <h2 id="h-top">Más vendidos del mes</h2>
          {d.top_productos_mes.length === 0 ? <p className="muted">Aún no hay ventas este mes.</p>
            : <BarrasHorizontales datos={d.top_productos_mes.map((p) => ({ etiqueta: p.nombre, valor: p.unidades }))} titulo="Unidades vendidas por producto" formato={(v) => `${v} u.`} />}
        </section>
      </div>
      {alertas > 0 && <p><Insignia tipo="warn">{alertas} producto(s) requieren atención</Insignia> <Link to="/inventario">Ver alertas de inventario</Link></p>}
      {esAdmin && <p className="muted"><Users size={16} style={{ verticalAlign: 'text-bottom' }} aria-hidden="true" /> Datos reales de la base de datos; se actualizan al recargar.</p>}
    </>
  );
}
