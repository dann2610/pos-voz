import { useCallback, useEffect, useRef, useState } from 'react';

/** Carga de datos con estados explícitos: cargando / error / datos. */
export function useCarga(fn, deps = []) {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const n = useRef(0);
  const cargar = useCallback(async () => {
    const mi = ++n.current;
    setCargando(true); setError('');
    try { const r = await fn(); if (mi === n.current) setDatos(r); }
    catch (e) { if (mi === n.current) setError(e.message || 'No se pudieron cargar los datos.'); }
    finally { if (mi === n.current) setCargando(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { cargar(); }, [cargar]);
  return { datos, cargando, error, recargar: cargar, setDatos };
}

export function useDebounce(valor, ms = 300) {
  const [v, setV] = useState(valor);
  useEffect(() => { const t = setTimeout(() => setV(valor), ms); return () => clearTimeout(t); }, [valor, ms]);
  return v;
}
