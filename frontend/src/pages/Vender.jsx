import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Minus, MousePointerClick, Mic, Plus, Trash2 } from 'lucide-react';
import { api } from '../services/api.js';
import { useCarga, useDebounce } from '../hooks/useCarga.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Aviso, Boton, Buscador, CabeceraPagina, Campo, Cargando, ErrorCarga, Vacio } from '../components/ui.jsx';
import VozPanel from '../components/VozPanel.jsx';
import Cobro from '../components/Cobro.jsx';
import { dinero, nuevaClave, totalesPrevios } from '../utils/format.js';

function VentaManual({ version, onRegistrada }) {
  const { config } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState(''); const [cat, setCat] = useState('');
  const bq = useDebounce(q);
  const { datos, cargando, error, recargar } = useCarga(() => api.get('/productos', { q: bq, id_categoria: cat, por_pagina: 60 }), [bq, cat, version]);
  const [categorias, setCategorias] = useState([]);
  useEffect(() => { api.get('/categorias', { por_pagina: 100, estado: true }).then((r) => setCategorias(r.datos)).catch(() => {}); }, []);
  const [carrito, setCarrito] = useState([]);
  const [cobro, setCobro] = useState({ metodo_pago: 'efectivo', id_cliente: null });
  const [enviando, setEnviando] = useState(false); const [errorVenta, setErrorVenta] = useState(''); const [venta, setVenta] = useState(null);
  const clave = useRef(null); const inicio = useRef(null);

  const tocarCarrito = useCallback((fn) => { clave.current = null; setCarrito(fn); }, []);
  const agregar = (p) => {
    if (!inicio.current) inicio.current = Date.now();
    setVenta(null); setErrorVenta('');
    tocarCarrito((c) => {
      const ex = c.find((i) => i.id_producto === p.id_producto);
      if (ex) return c.map((i) => (i.id_producto === p.id_producto ? { ...i, cantidad: Math.min(p.stock, i.cantidad + 1) } : i));
      return [...c, { id_producto: p.id_producto, nombre: p.nombre, descripcion: p.descripcion, precio: p.precio, stock: p.stock, cantidad: 1 }];
    });
  };
  const fijar = (id, n) => tocarCarrito((c) => c.map((i) => (i.id_producto === id ? { ...i, cantidad: Math.max(1, Math.min(i.stock, Number(n) || 1)) } : i)));
  const quitar = (id) => tocarCarrito((c) => c.filter((i) => i.id_producto !== id));
  const tot = useMemo(() => totalesPrevios(carrito, config?.tasa_impuesto ?? 0), [carrito, config]);

  async function registrar() {
    setEnviando(true); setErrorVenta('');
    if (!clave.current) clave.current = nuevaClave();
    try {
      const v = await api.post('/ventas', {
        items: carrito.map((i) => ({ id_producto: i.id_producto, cantidad: i.cantidad })), metodo_pago: cobro.metodo_pago, id_cliente: cobro.id_cliente,
        clave_idempotencia: clave.current, duracion_seg: inicio.current ? Math.round((Date.now() - inicio.current) / 1000) : undefined,
      });
      setVenta(v); setCarrito([]); clave.current = null; inicio.current = null; toast.exito(`Venta #${v.id_venta} registrada.`); onRegistrada?.(); recargar();
    } catch (e) {
      setErrorVenta(e.message); if (e.status === 409) recargar();
    } finally { setEnviando(false); }
  }

  return (
    <div className="pos">
      <section className="tarjeta" aria-labelledby="t-catalogo">
        <h2 id="t-catalogo">Productos</h2>
        <div className="filtros" style={{ marginTop: 14 }}>
          <Buscador valor={q} onChange={setQ} etiqueta="Buscar producto" placeholder="Buscar producto…" />
          <Campo etiqueta="Categoría">{(p) => <select {...p} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Todas</option>{categorias.map((c) => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>)}</select>}</Campo>
        </div>
        {cargando ? <Cargando /> : error ? <ErrorCarga mensaje={error} onReintentar={recargar} /> : datos.datos.length === 0 ? <Vacio texto="No hay productos para mostrar." /> : (
          <div className="productos-rejilla">
            {datos.datos.map((p) => {
              const enCarrito = carrito.find((i) => i.id_producto === p.id_producto)?.cantidad ?? 0;
              const agotado = p.stock === 0 || enCarrito >= p.stock;
              return (
                <button key={p.id_producto} className="producto-btn" disabled={agotado} onClick={() => agregar(p)}
                  aria-label={`${p.nombre}${p.descripcion ? ', ' + p.descripcion : ''}, ${dinero(p.precio)}, ${p.stock === 0 ? 'agotado' : p.stock + ' disponibles'}`}>
                  <strong>{p.nombre}</strong><small>{p.descripcion}</small>
                  <span className="precio">{dinero(p.precio)}</span>
                  <small>{p.stock === 0 ? 'Agotado' : p.stock <= p.stock_minimo ? `Quedan ${p.stock} (bajo)` : `Stock: ${p.stock}`}{enCarrito ? ` · en carrito: ${enCarrito}` : ''}</small>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="tarjeta" aria-labelledby="t-carrito" style={{ position: 'sticky', top: 12 }}>
        <h2 id="t-carrito">Venta actual</h2>
        {venta && <Aviso tipo="ok" style={{ marginTop: 12 }}><strong>Venta #{venta.id_venta} registrada por {dinero(venta.total)}.</strong></Aviso>}
        {errorVenta && <Aviso tipo="error" style={{ marginTop: 12 }}>{errorVenta}</Aviso>}
        {carrito.length === 0 ? <Vacio texto="Toca un producto para agregarlo." /> : (
          <>
            <ul className="carrito-lista" style={{ marginTop: 12 }}>
              {carrito.map((i) => (
                <li key={i.id_producto} className="carrito-item">
                  <div><strong>{i.nombre}</strong><div className="muted">{dinero(i.precio)} c/u · {dinero(Number(i.precio) * i.cantidad)}</div></div>
                  <div className="acciones">
                    <span className="cantidad">
                      <Boton icono={Minus} aria-label={`Menos ${i.nombre}`} disabled={i.cantidad <= 1} onClick={() => fijar(i.id_producto, i.cantidad - 1)} />
                      <input type="number" inputMode="numeric" min="1" max={i.stock} value={i.cantidad} aria-label={`Cantidad de ${i.nombre}`} onChange={(e) => fijar(i.id_producto, e.target.value)} />
                      <Boton icono={Plus} aria-label={`Más ${i.nombre}`} disabled={i.cantidad >= i.stock} onClick={() => fijar(i.id_producto, i.cantidad + 1)} />
                    </span>
                    <Boton icono={Trash2} aria-label={`Quitar ${i.nombre}`} onClick={() => quitar(i.id_producto)} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="totales">
              <div><span>Subtotal</span><span>{dinero(tot.subtotal)}</span></div>
              <div><span>Impuesto ({Number(config?.tasa_impuesto ?? 0)}%)</span><span>{dinero(tot.impuesto)}</span></div>
              <div className="total-final"><span>Total</span><span>{dinero(tot.total)}</span></div>
            </div>
            <p className="muted" style={{ fontSize: '.85rem', marginTop: 6 }}>Vista previa: el total definitivo lo calcula el servidor al registrar.</p>
            <div style={{ marginTop: 14 }}><Cobro valor={cobro} onChange={setCobro} /></div>
            <div className="acciones" style={{ marginTop: 16 }}>
              <Boton variante="primario" grande icono={CheckCircle2} cargando={enviando} onClick={registrar}>Registrar venta</Boton>
              <Boton onClick={() => { tocarCarrito(() => []); inicio.current = null; }} disabled={enviando}>Vaciar</Boton>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default function Vender() {
  const [modo, setModo] = useState('voz');
  const [version, setVersion] = useState(0);
  const refrescar = () => setVersion((v) => v + 1);
  return (
    <>
      <CabeceraPagina titulo="Nueva venta" descripcion="Vende por voz o de forma manual: ambos modos registran lo mismo y actualizan el inventario.">
        <div className="modos" role="group" aria-label="Modo de venta">
          <button aria-pressed={modo === 'voz'} onClick={() => setModo('voz')}><Mic size={20} aria-hidden="true" />Voz</button>
          <button aria-pressed={modo === 'manual'} onClick={() => { setModo('manual'); refrescar(); }}><MousePointerClick size={20} aria-hidden="true" />Manual</button>
        </div>
      </CabeceraPagina>
      <div hidden={modo !== 'voz'}><VozPanel onVentaRegistrada={refrescar} /></div>
      <div hidden={modo !== 'manual'}><VentaManual version={version} onRegistrada={refrescar} /></div>
    </>
  );
}
