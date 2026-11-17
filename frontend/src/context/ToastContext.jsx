import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const Ctx = createContext(null);
export const useToast = () => useContext(Ctx);
const ICONOS = { exito: CheckCircle2, error: AlertCircle, info: Info };

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const quitar = useCallback((id) => setItems((l) => l.filter((x) => x.id !== id)), []);
  const mostrar = useCallback((tipo, texto) => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l.slice(-3), { id, tipo, texto }]);
    setTimeout(() => quitar(id), tipo === 'error' ? 8000 : 4500);
  }, [quitar]);
  const api = useMemo(() => ({
    exito: (t) => mostrar('exito', t), error: (t) => mostrar('error', t), info: (t) => mostrar('info', t),
  }), [mostrar]);
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="region" aria-label="Notificaciones" aria-live="polite">
        {items.map((t) => {
          const I = ICONOS[t.tipo];
          return (
            <div key={t.id} className={`toast toast-${t.tipo}`} role={t.tipo === 'error' ? 'alert' : 'status'}>
              <I size={20} aria-hidden="true" /><span>{t.texto}</span>
              <button className="icono-btn" onClick={() => quitar(t.id)} aria-label="Cerrar notificación"><X size={18} aria-hidden="true" /></button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
