import { useCallback, useEffect, useRef, useState } from 'react';
import { IDIOMAS, ReconocimientoVoz, mensajeErrorVoz } from '../utils/voz.js';

/**
 * Estados: 'inactivo' | 'escuchando' | 'error'. El texto final se entrega en onResultado.
 * Si el idioma es-EC no está soportado, reintenta con es-ES y es-419.
 */
export function useReconocimiento({ onResultado }) {
  const [estado, setEstado] = useState('inactivo');
  const [parcial, setParcial] = useState('');
  const [error, setError] = useState('');
  const rec = useRef(null);
  const idiomaIdx = useRef(0);
  const cb = useRef(onResultado);
  cb.current = onResultado;
  const soportado = !!ReconocimientoVoz();

  const detener = useCallback(() => { try { rec.current?.stop(); } catch { /* ya detenido */ } }, []);

  const iniciar = useCallback(() => {
    const Clase = ReconocimientoVoz();
    if (!Clase) { setError('Tu navegador no admite reconocimiento de voz. Usa Chrome o Edge, o el modo manual.'); setEstado('error'); return; }
    try { rec.current?.abort(); } catch { /* nada */ }
    const r = new Clase();
    r.lang = IDIOMAS[idiomaIdx.current] || 'es-ES';
    r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    let final = '';
    let reintento = false;
    r.onstart = () => { setEstado('escuchando'); setError(''); setParcial(''); };
    r.onresult = (e) => {
      let tmp = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else tmp += t;
      }
      setParcial((final + tmp).trim());
    };
    r.onerror = (e) => {
      if (e.error === 'language-not-supported' && idiomaIdx.current < IDIOMAS.length - 1) {
        idiomaIdx.current += 1; reintento = true; setTimeout(iniciar, 50); return;
      }
      const msg = mensajeErrorVoz(e.error);
      if (msg) { setError(msg); setEstado('error'); }
    };
    r.onend = () => {
      if (reintento) return;
      setEstado((s) => (s === 'error' ? s : 'inactivo'));
      const texto = final.trim();
      if (texto) cb.current?.(texto);
    };
    rec.current = r;
    try { r.start(); } catch { setError('No se pudo iniciar el micrófono.'); setEstado('error'); }
  }, []);

  useEffect(() => () => { try { rec.current?.abort(); } catch { /* nada */ } }, []);
  return { soportado, estado, parcial, error, iniciar, detener, limpiarError: () => { setError(''); setEstado('inactivo'); } };
}
