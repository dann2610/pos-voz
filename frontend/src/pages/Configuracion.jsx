import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Aviso, Boton, CabeceraPagina, Campo, erroresDeCampos } from '../components/ui.jsx';

export default function Configuracion() {
  const { config, recargarConfig } = useAuth();
  const toast = useToast();
  const [f, setF] = useState(null); const [err, setErr] = useState({}); const [msg, setMsg] = useState(''); const [cargando, setCargando] = useState(false);
  useEffect(() => { if (config) setF({ ...config }); }, [config]);
  if (!f) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function guardar(e) {
    e.preventDefault(); setCargando(true); setErr({}); setMsg('');
    try {
      await api.put('/configuracion', {
        nombre_negocio: f.nombre_negocio, tasa_impuesto: Number(f.tasa_impuesto), umbral_similitud: Number(f.umbral_similitud),
        margen_ambiguedad: Number(f.margen_ambiguedad), minutos_caducidad: Number(f.minutos_caducidad),
      });
      await recargarConfig(); toast.exito('Configuración guardada.');
    } catch (x) { setErr(erroresDeCampos(x)); setMsg(x.message); } finally { setCargando(false); }
  }
  return (
    <>
      <CabeceraPagina titulo="Configuración" descripcion="Parámetros del negocio y del reconocimiento por voz." />
      <form className="tarjeta" onSubmit={guardar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 820 }}>
        {msg && <Aviso tipo="error">{msg}</Aviso>}
        <h2>Negocio</h2>
        <div className="fila-form">
          <Campo etiqueta="Nombre del negocio" requerido error={err.nombre_negocio}>{(p) => <input {...p} maxLength={100} value={f.nombre_negocio} onChange={set('nombre_negocio')} />}</Campo>
          <Campo etiqueta="Impuesto (%)" error={err.tasa_impuesto} ayuda="Se aplica a las ventas nuevas. Las anteriores conservan su tasa. 0 = sin impuesto.">{(p) => <input {...p} type="number" min="0" max="100" step="0.01" value={f.tasa_impuesto} onChange={set('tasa_impuesto')} />}</Campo>
        </div>
        <h2>Reconocimiento por voz</h2>
        <div className="fila-form">
          <Campo etiqueta="Umbral de similitud (0.30 – 1.00)" error={err.umbral_similitud} ayuda="Más alto = más exigente al reconocer nombres de productos.">{(p) => <input {...p} type="number" min="0.3" max="1" step="0.01" value={f.umbral_similitud} onChange={set('umbral_similitud')} />}</Campo>
          <Campo etiqueta="Margen de ambigüedad (0 – 0.50)" error={err.margen_ambiguedad} ayuda="Si dos productos puntúan casi igual, el sistema te pide elegir.">{(p) => <input {...p} type="number" min="0" max="0.5" step="0.01" value={f.margen_ambiguedad} onChange={set('margen_ambiguedad')} />}</Campo>
          <Campo etiqueta="Caducidad del pedido por voz (minutos)" error={err.minutos_caducidad} ayuda="Tiempo máximo para confirmar un pedido dictado.">{(p) => <input {...p} type="number" min="1" max="60" step="1" value={f.minutos_caducidad} onChange={set('minutos_caducidad')} />}</Campo>
        </div>
        <Aviso tipo="info"><strong>Privacidad:</strong> el sistema no guarda audio. Sin embargo, el reconocimiento de voz del navegador (Web Speech API) puede enviar el audio a un servicio externo del fabricante del navegador (por ejemplo, Google en Chrome) para transcribirlo.</Aviso>
        <div><Boton type="submit" variante="primario" icono={Save} cargando={cargando}>Guardar cambios</Boton></div>
      </form>
    </>
  );
}
