import { useState } from 'react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Aviso, Boton, CabeceraPagina, Campo, erroresDeCampos } from '../components/ui.jsx';

export default function Perfil() {
  const { usuario, setUsuario } = useAuth();
  const toast = useToast();
  const [p, setP] = useState({ nombre: usuario.nombre, apellido: usuario.apellido });
  const [c, setC] = useState({ actual: '', nueva: '', repetir: '' });
  const [e1, setE1] = useState({}); const [e2, setE2] = useState({}); const [m1, setM1] = useState(''); const [m2, setM2] = useState('');
  const [l1, setL1] = useState(false); const [l2, setL2] = useState(false);

  async function guardarPerfil(e) {
    e.preventDefault(); setL1(true); setE1({}); setM1('');
    try { const r = await api.put('/auth/perfil', p); setUsuario(r.usuario); toast.exito('Perfil actualizado.'); }
    catch (x) { setE1(erroresDeCampos(x)); setM1(x.message); } finally { setL1(false); }
  }
  async function cambiar(e) {
    e.preventDefault(); setE2({}); setM2('');
    if (c.nueva !== c.repetir) { setE2({ repetir: 'Las contraseñas no coinciden.' }); return; }
    setL2(true);
    try { await api.put('/auth/contrasena', { actual: c.actual, nueva: c.nueva }); toast.exito('Contraseña actualizada.'); setC({ actual: '', nueva: '', repetir: '' }); }
    catch (x) { setE2(erroresDeCampos(x)); setM2(x.message); } finally { setL2(false); }
  }
  return (
    <>
      <CabeceraPagina titulo="Mi perfil" descripcion={`${usuario.correo} · ${usuario.rol === 'administrador' ? 'Administrador' : 'Vendedor'}`} />
      <div className="rejilla rejilla-2">
        <form className="tarjeta" onSubmit={guardarPerfil} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2>Datos personales</h2>{m1 && <Aviso tipo="error">{m1}</Aviso>}
          <Campo etiqueta="Nombre" requerido error={e1.nombre}>{(x) => <input {...x} value={p.nombre} onChange={(e) => setP({ ...p, nombre: e.target.value })} />}</Campo>
          <Campo etiqueta="Apellido" requerido error={e1.apellido}>{(x) => <input {...x} value={p.apellido} onChange={(e) => setP({ ...p, apellido: e.target.value })} />}</Campo>
          <div><Boton type="submit" variante="primario" cargando={l1}>Guardar</Boton></div>
        </form>
        <form className="tarjeta" onSubmit={cambiar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2>Cambiar contraseña</h2>{m2 && <Aviso tipo="error">{m2}</Aviso>}
          <Campo etiqueta="Contraseña actual" requerido error={e2.actual}>{(x) => <input {...x} type="password" autoComplete="current-password" value={c.actual} onChange={(e) => setC({ ...c, actual: e.target.value })} />}</Campo>
          <Campo etiqueta="Nueva contraseña" requerido error={e2.nueva} ayuda="Mínimo 8 caracteres, con letras y números.">{(x) => <input {...x} type="password" autoComplete="new-password" value={c.nueva} onChange={(e) => setC({ ...c, nueva: e.target.value })} />}</Campo>
          <Campo etiqueta="Repetir nueva contraseña" requerido error={e2.repetir}>{(x) => <input {...x} type="password" autoComplete="new-password" value={c.repetir} onChange={(e) => setC({ ...c, repetir: e.target.value })} />}</Campo>
          <div><Boton type="submit" variante="primario" cargando={l2} disabled={!c.actual || !c.nueva}>Actualizar contraseña</Boton></div>
        </form>
      </div>
    </>
  );
}
