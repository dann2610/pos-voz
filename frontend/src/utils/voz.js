// Web Speech API: reconocimiento (SpeechRecognition) y síntesis (speechSynthesis).
// Aviso: según el navegador, el reconocimiento puede enviar el audio a un servicio externo (p. ej., Google en Chrome).
export const ReconocimientoVoz = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null);
export const soportaReconocimiento = () => !!ReconocimientoVoz();
export const soportaSintesis = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

export const IDIOMAS = ['es-EC', 'es-ES', 'es-419'];

export function mensajeErrorVoz(codigo) {
  const m = {
    'not-allowed': 'No hay permiso para usar el micrófono. Actívalo en el navegador o usa el modo manual.',
    'service-not-allowed': 'El navegador bloqueó el reconocimiento de voz. Usa el modo manual.',
    'no-speech': 'No te escuché. Pulsa el micrófono e inténtalo de nuevo.',
    'audio-capture': 'No se encontró un micrófono disponible.',
    network: 'El reconocimiento de voz necesita conexión a internet y no pudo conectarse.',
    'language-not-supported': 'El idioma no es compatible; se intentará con otra variante del español.',
    aborted: null, // el usuario detuvo la escucha: no es un error
  };
  return codigo in m ? m[codigo] : 'No se pudo reconocer la voz. Inténtalo de nuevo o usa el modo manual.';
}

export function hablar(texto, { onFin } = {}) {
  if (!soportaSintesis() || !texto) { onFin?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  const voces = window.speechSynthesis.getVoices();
  const voz = voces.find((v) => v.lang === 'es-EC') || voces.find((v) => v.lang?.startsWith('es-419')) || voces.find((v) => v.lang?.startsWith('es'));
  if (voz) { u.voice = voz; u.lang = voz.lang; } else u.lang = 'es-ES';
  u.rate = 1;
  u.onend = () => onFin?.();
  u.onerror = () => onFin?.();
  window.speechSynthesis.speak(u);
}
export const callar = () => { if (soportaSintesis()) window.speechSynthesis.cancel(); };
