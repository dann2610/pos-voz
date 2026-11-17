import { useEffect, useId, useRef } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, Search, X, Inbox, TriangleAlert } from 'lucide-react';

export function Boton({ variante, grande, bloque, peq, cargando, icono: Icono, children, className = '', ...p }) {
  const cls = ['btn', variante && `btn-${variante}`, grande && 'btn-grande', bloque && 'btn-bloque', peq && 'btn-peq', className].filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} disabled={p.disabled || cargando} {...p}>
      {cargando ? <Loader2 size={18} className="spin" aria-hidden="true" /> : Icono && <Icono size={20} aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Campo con etiqueta, ayuda y error enlazados (accesibilidad). */
export function Campo({ etiqueta, error, ayuda, children, id: idProp, requerido }) {
  const auto = useId();
  const id = idProp || auto;
  const hijo = children({ id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': [error && `${id}-e`, ayuda && `${id}-a`].filter(Boolean).join(' ') || undefined, required: requerido });
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}{requerido && <span aria-hidden="true"> *</span>}</label>
      {hijo}
      {ayuda && <span className="ayuda" id={`${id}-a`}>{ayuda}</span>}
      {error && <span className="error-campo" id={`${id}-e`} role="alert">{error}</span>}
    </div>
  );
}

export const Insignia = ({ tipo = 'neutro', children }) => <span className={`insignia insignia-${tipo}`}>{children}</span>;
export const EstadoInsignia = ({ activo }) => <Insignia tipo={activo ? 'ok' : 'neutro'}>{activo ? 'Activo' : 'Inactivo'}</Insignia>;
export const StockInsignia = ({ estado }) => {
  const m = { agotado: ['peligro', 'Agotado'], bajo: ['warn', 'Stock bajo'], normal: ['ok', 'Disponible'] }[estado] || ['neutro', estado];
  return <Insignia tipo={m[0]}>{m[1]}</Insignia>;
};

export const Cargando = ({ texto = 'Cargando…' }) => (
  <div className="estado-carga" role="status"><Loader2 size={30} className="spin" aria-hidden="true" /><span>{texto}</span></div>
);
export const Vacio = ({ texto = 'No hay datos para mostrar.', children }) => (
  <div className="estado-vacio"><Inbox size={32} aria-hidden="true" /><p>{texto}</p>{children}</div>
);
export const ErrorCarga = ({ mensaje, onReintentar }) => (
  <div className="estado-error" role="alert"><AlertCircle size={32} aria-hidden="true" /><p>{mensaje}</p>{onReintentar && <Boton onClick={onReintentar}>Reintentar</Boton>}</div>
);

const ICONO_AVISO = { info: Info, warn: TriangleAlert, error: AlertCircle, ok: CheckCircle2 };
export function Aviso({ tipo = 'info', children, ...p }) {
  const I = ICONO_AVISO[tipo];
  return <div className={`aviso aviso-${tipo}`} role={tipo === 'error' ? 'alert' : undefined} {...p}><I size={20} aria-hidden="true" /><div>{children}</div></div>;
}

export function Buscador({ valor, onChange, etiqueta = 'Buscar', placeholder = 'Buscar…' }) {
  const id = useId();
  return (
    <div className="buscador">
      <label htmlFor={id} className="solo-lectores">{etiqueta}</label>
      <Search size={20} aria-hidden="true" />
      <input id={id} type="search" value={valor} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Paginacion({ pag, onCambiar }) {
  if (!pag) return null;
  const desde = pag.total === 0 ? 0 : (pag.pagina - 1) * pag.por_pagina + 1;
  const hasta = Math.min(pag.total, pag.pagina * pag.por_pagina);
  return (
    <nav className="paginacion" aria-label="Paginación">
      <span aria-live="polite">{desde}–{hasta} de {pag.total}</span>
      <div className="acciones">
        <Boton peq icono={ChevronLeft} disabled={pag.pagina <= 1} onClick={() => onCambiar(pag.pagina - 1)}>Anterior</Boton>
        <span>Página {pag.pagina} de {pag.paginas}</span>
        <Boton peq disabled={pag.pagina >= pag.paginas} onClick={() => onCambiar(pag.pagina + 1)}>Siguiente <ChevronRight size={18} aria-hidden="true" /></Boton>
      </div>
    </nav>
  );
}

/** Diálogo accesible: foco atrapado, Escape cierra, devuelve el foco. */
export function Modal({ titulo, onCerrar, children, pie, ancho }) {
  const ref = useRef(null);
  const tid = useId();
  useEffect(() => {
    const previo = document.activeElement;
    const el = ref.current;
    const foco = () => el.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    (foco()[1] || foco()[0])?.focus();
    const tecla = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); }
      if (e.key === 'Tab') {
        const f = [...foco()]; if (!f.length) return;
        const a = f[0]; const z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', tecla); document.body.style.overflow = ''; previo?.focus?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="modal-fondo" onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <div className={`modal ${ancho ? 'modal-ancho' : ''}`} role="dialog" aria-modal="true" aria-labelledby={tid} ref={ref}>
        <div className="modal-cab"><h2 id={tid}>{titulo}</h2><button className="icono-btn" onClick={onCerrar} aria-label="Cerrar"><X size={22} aria-hidden="true" /></button></div>
        <div className="modal-cuerpo">{children}</div>
        {pie && <div className="modal-pie">{pie}</div>}
      </div>
    </div>
  );
}

export function Confirmar({ titulo, mensaje, textoOk = 'Confirmar', peligro, cargando, onOk, onCancelar }) {
  return (
    <Modal titulo={titulo} onCerrar={onCancelar} pie={<>
      <Boton onClick={onCancelar}>Cancelar</Boton>
      <Boton variante={peligro ? 'peligro' : 'primario'} cargando={cargando} onClick={onOk}>{textoOk}</Boton>
    </>}>
      <p>{mensaje}</p>
    </Modal>
  );
}

export function Pestanas({ valor, onChange, opciones, etiqueta }) {
  return (
    <div className="tabs" role="tablist" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.id} role="tab" id={`tab-${o.id}`} aria-selected={valor === o.id} aria-controls={`panel-${o.id}`} onClick={() => onChange(o.id)}>{o.texto}</button>
      ))}
    </div>
  );
}

export const CabeceraPagina = ({ titulo, descripcion, children }) => (
  <div className="cabecera-pagina"><div><h1>{titulo}</h1>{descripcion && <p>{descripcion}</p>}</div>{children && <div className="acciones">{children}</div>}</div>
);

/** Convierte errores de la API (con detalles por campo) en { campo: mensaje }. */
export function erroresDeCampos(e) {
  const m = {};
  (e?.detalles || []).forEach((d) => { if (d.campo) m[d.campo] = d.mensaje; });
  return m;
}
