import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Mic, MicOff, Minus, Pencil, Plus, RotateCcw, Send, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { api } from '../services/api.js';
import { useReconocimiento } from '../hooks/useReconocimiento.js';
import { callar, hablar, soportaSintesis } from '../utils/voz.js';
import { dinero } from '../utils/format.js';
import { useToast } from '../context/ToastContext.jsx';
import { Aviso, Boton } from './ui.jsx';
import Cobro from './Cobro.jsx';

const ETIQUETA_ESTADO = { ok: null, ambiguo: 'Elige una opción', no_encontrado: 'No encontrado', sin_stock: 'Sin stock suficiente' };

function minutosRestantes(expira) {
  const ms = new Date(expira).getTime() - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / 60000);
}

export default function VozPanel({ onVentaRegistrada }) {
  const toast = useToast();
  const [pedido, setPedido] = useState(null);       // pedido pendiente (si existe)
  const [respuesta, setRespuesta] = useState(null); // último mensaje del sistema
  const [reconocido, setReconocido] = useState('');
  const [texto, setTexto] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [cobro, setCobro] = useState({ metodo_pago: 'efectivo', id_cliente: null });
  const [habladas, setHabladas] = useState(soportaSintesis());
  const [venta, setVenta] = useState(null);
  const [, setReloj] = useState(0);
  const inicio = useRef(null);
  const pedidoRef = useRef(null);
  pedidoRef.current = pedido;
  const habladasRef = useRef(habladas);
  habladasRef.current = habladas;

  const decir = useCallback((t) => { if (habladasRef.current) hablar(t); }, []);

  const aplicar = useCallback((r) => {
    setRespuesta({ mensaje: r.mensaje, tipo: r.intent });
    if (r.items && r.estado === 'pendiente') setPedido(r);
    else if (r.estado === 'cancelado' || r.estado === 'caducado' || r.estado === 'confirmado') setPedido(null);
    decir(r.habla);
  }, [decir]);

  const confirmar = useCallback(async (p = pedidoRef.current, c = cobro) => {
    if (!p) return;
    setProcesando(true);
    try {
      const duracion = inicio.current ? Math.round((Date.now() - inicio.current) / 1000) : undefined;
      const r = await api.post(`/voz/pedidos/${p.id_pedido}/confirmar`, { metodo_pago: c.metodo_pago, id_cliente: c.id_cliente, duracion_seg: duracion });
      setVenta(r.venta); setPedido(null); setRespuesta({ mensaje: r.mensaje, tipo: 'confirmado' }); inicio.current = null;
      decir(r.habla); toast.exito(r.mensaje); onVentaRegistrada?.(r.venta);
    } catch (e) {
      setRespuesta({ mensaje: e.message, tipo: 'error' }); decir(e.message); toast.error(e.message);
    } finally { setProcesando(false); }
  }, [cobro, decir, onVentaRegistrada, toast]);

  const enviar = useCallback(async (t) => {
    const limpio = t.trim();
    if (!limpio) return;
    setProcesando(true); setVenta(null); setReconocido(limpio);
    if (!inicio.current) inicio.current = Date.now();
    try {
      const p = pedidoRef.current;
      const r = await api.post('/voz/interpretar', { texto: limpio, id_pedido: p?.id_pedido });
      if (r.accion === 'confirmar') { await confirmar(r.id_pedido ? r : p); return; }
      aplicar(r);
      const sigue = r.items && r.estado === 'pendiente';
      const soloConsulta = ['consultar_precio', 'consultar_stock', 'desconocido'].includes(r.intent) && pedidoRef.current;
      if (!sigue && !soloConsulta) inicio.current = null;
    } catch (e) {
      setRespuesta({ mensaje: e.message, tipo: 'error' }); decir(e.message);
    } finally { setProcesando(false); setTexto(''); }
  }, [aplicar, confirmar, decir]);

  const rec = useReconocimiento({ onResultado: enviar });

  // Contador de caducidad (se refresca cada 20 s).
  useEffect(() => { if (!pedido) return undefined; const t = setInterval(() => setReloj((x) => x + 1), 20000); return () => clearInterval(t); }, [pedido]);
  useEffect(() => () => callar(), []);

  const cambiarCantidad = async (indice, cantidad) => {
    setProcesando(true);
    try { aplicar(await api.patch(`/voz/pedidos/${pedido.id_pedido}/items/${indice}`, { cantidad })); }
    catch (e) { toast.error(e.message); } finally { setProcesando(false); }
  };
  const elegir = async (indice, id_producto) => {
    setProcesando(true);
    try { aplicar(await api.post(`/voz/pedidos/${pedido.id_pedido}/resolver`, { indice, id_producto })); }
    catch (e) { toast.error(e.message); } finally { setProcesando(false); }
  };
  const cancelar = async () => {
    if (!pedido) return;
    setProcesando(true);
    try { aplicar(await api.post(`/voz/pedidos/${pedido.id_pedido}/cancelar`)); setPedido(null); inicio.current = null; }
    catch (e) { toast.error(e.message); } finally { setProcesando(false); }
  };

  const pulsarMic = () => {
    callar();
    if (rec.estado === 'escuchando') rec.detener();
    else { if (!inicio.current) inicio.current = Date.now(); setVenta(null); rec.iniciar(); }
  };
  const escuchando = rec.estado === 'escuchando';
  const estadoTexto = procesando ? 'Procesando…' : escuchando ? 'Escuchando… habla ahora' : rec.error ? rec.error : 'Listo. Pulsa el micrófono y di tu pedido.';

  return (
    <div className="voz">
      {!rec.soportado && <Aviso tipo="warn"><strong>Tu navegador no admite reconocimiento de voz.</strong> Puedes escribir el comando abajo o cambiar al modo manual. Para voz, usa Chrome o Edge.</Aviso>}
      <section className="tarjeta" aria-labelledby="t-voz">
        <h2 id="t-voz">Vender por voz</h2>
        <div className="voz-cuerpo" style={{ marginTop: 14 }}>
          <button className={`mic ${escuchando ? 'escuchando' : ''}`} onClick={pulsarMic} disabled={!rec.soportado || procesando} aria-label={escuchando ? 'Detener escucha' : 'Hablar: iniciar escucha'}>
            {escuchando ? <MicOff size={52} aria-hidden="true" /> : <Mic size={52} aria-hidden="true" />}
          </button>
          <div className="voz-estado">
            <p className="estado" role="status" aria-live="polite">{estadoTexto}</p>
            <div className="texto-reconocido" aria-label="Texto reconocido">
              {escuchando ? (rec.parcial || <span className="muted">…</span>) : reconocido ? <>«{reconocido}»</> : <span className="muted">Aquí aparecerá lo que dijiste.</span>}
            </div>
            <div className="acciones">
              {reconocido && !escuchando && <Boton peq icono={Pencil} onClick={() => setTexto(reconocido)}>Editar texto</Boton>}
              {rec.soportado && reconocido && !escuchando && <Boton peq icono={RotateCcw} onClick={pulsarMic} disabled={procesando}>Repetir</Boton>}
              {soportaSintesis() && (
                <Boton peq icono={habladas ? Volume2 : VolumeX} aria-pressed={habladas} onClick={() => { if (habladas) callar(); setHabladas(!habladas); }}>{habladas ? 'Respuestas habladas: sí' : 'Respuestas habladas: no'}</Boton>
              )}
            </div>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); enviar(texto); }} style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <label htmlFor="cmd-texto" className="solo-lectores">Escribir o corregir el comando</label>
            <input id="cmd-texto" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe un comando, p. ej.: vender dos Coca-Cola" maxLength={300} />
          </div>
          <Boton type="submit" icono={Send} disabled={!texto.trim() || procesando}>Enviar</Boton>
        </form>
        <p className="ejemplos" style={{ marginTop: 12 }}>Prueba: <code>Vender dos Coca-Cola</code> · <code>¿Cuánto cuesta la leche?</code> · <code>¿Cuántas unidades quedan de arroz?</code> · <code>Confirmar la venta</code> · <code>Cancelar el pedido actual</code></p>
        <p className="ejemplos" style={{ marginTop: 6 }}>Privacidad: el sistema no guarda tu audio; el navegador puede enviarlo a un servicio externo para transcribirlo.</p>
      </section>

      <div aria-live="polite">
        {respuesta && !pedido && !venta && <Aviso tipo={respuesta.tipo === 'error' ? 'error' : 'info'}>{respuesta.mensaje}</Aviso>}
      </div>

      {venta && (
        <Aviso tipo="ok"><strong>Venta #{venta.id_venta} registrada por {dinero(venta.total)}.</strong> {venta.detalle.map((d) => `${d.cantidad} ${d.nombre_producto}`).join(', ')}.</Aviso>
      )}

      {pedido && (
        <section className="pedido-voz" aria-labelledby="t-pedido">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <h2 id="t-pedido">Pedido por confirmar</h2>
            <span className="muted">Caduca en {minutosRestantes(pedido.expira_en)} min</span>
          </div>
          {respuesta?.mensaje && <Aviso tipo={pedido.listo_para_confirmar ? 'ok' : 'warn'} aria-live="polite">{respuesta.mensaje}</Aviso>}
          <ul className="carrito-lista">
            {pedido.items.map((it, i) => (
              <li key={`${i}-${it.texto}`} className={`pedido-item ${it.estado}`}>
                <div>
                  <strong>{it.estado === 'ok' || it.estado === 'sin_stock' ? `${it.cantidad} × ${it.nombre}` : `${it.cantidad} × "${it.texto}"`}</strong>
                  {it.descripcion && <span className="muted"> · {it.descripcion}</span>}
                  <div>{it.estado === 'ok' ? <span className="muted">{dinero(it.precio)} c/u · {dinero(Number(it.precio) * it.cantidad)}</span> : <span style={{ color: 'var(--c-danger)', fontWeight: 600 }}>{ETIQUETA_ESTADO[it.estado]}{it.mensaje ? ` — ${it.mensaje}` : ''}</span>}</div>
                </div>
                <div className="acciones">
                  {(it.estado === 'ok' || it.estado === 'sin_stock') && (
                    <span className="cantidad">
                      <Boton peq icono={Minus} aria-label={`Quitar una unidad de ${it.nombre}`} disabled={procesando || it.cantidad <= 1} onClick={() => cambiarCantidad(i, it.cantidad - 1)} />
                      <span aria-live="polite" style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>{it.cantidad}</span>
                      <Boton peq icono={Plus} aria-label={`Agregar una unidad de ${it.nombre}`} disabled={procesando} onClick={() => cambiarCantidad(i, it.cantidad + 1)} />
                    </span>
                  )}
                  <Boton peq icono={Trash2} aria-label={`Quitar ${it.nombre || it.texto} del pedido`} disabled={procesando} onClick={() => cambiarCantidad(i, 0)} />
                </div>
                {(it.estado === 'ambiguo' || it.estado === 'no_encontrado') && it.opciones?.length > 0 && (
                  <div className="opciones" role="group" aria-label={it.estado === 'ambiguo' ? `Opciones para ${it.texto}` : `Sugerencias para ${it.texto}`}>
                    <span className="muted">{it.estado === 'ambiguo' ? 'Di «el primero», «el segundo»… o toca una opción:' : '¿Quisiste decir…?'}</span>
                    {it.opciones.map((o, k) => (
                      <Boton key={o.id_producto} disabled={procesando} onClick={() => elegir(i, o.id_producto)}>
                        {k + 1}. {o.nombre}{o.descripcion ? ` — ${o.descripcion}` : ''} · {dinero(o.precio)} · stock {o.stock}
                      </Boton>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="totales">
            <div><span>Subtotal</span><span>{dinero(pedido.resumen.subtotal)}</span></div>
            <div><span>Impuesto</span><span>{dinero(pedido.resumen.impuesto)}</span></div>
            <div className="total-final"><span>Total</span><span>{dinero(pedido.resumen.total)}</span></div>
          </div>
          <Cobro valor={cobro} onChange={setCobro} />
          <div className="acciones">
            <Boton variante="primario" grande icono={CheckCircle2} disabled={!pedido.listo_para_confirmar || procesando} cargando={procesando} onClick={() => confirmar()}>Confirmar venta</Boton>
            <Boton icono={X} onClick={cancelar} disabled={procesando}>Cancelar pedido</Boton>
          </div>
          {!pedido.listo_para_confirmar && <p className="muted">Resuelve o quita los productos marcados para poder confirmar.</p>}
        </section>
      )}
    </div>
  );
}
