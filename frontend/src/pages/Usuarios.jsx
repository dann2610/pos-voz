import { useEffect, useState } from 'react';
import { Plus, Pencil, Power } from 'lucide-react';
import { api } from '../services/api.js';
import { useCarga, useDebounce } from '../hooks/useCarga.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Aviso, Boton, Buscador, CabeceraPagina, Campo, Cargando, Confirmar, ErrorCarga, EstadoInsignia, Insignia, Modal, Paginacion, Vacio, erroresDeCampos } from '../components/ui.jsx';
import { fechaHora } from '../utils/format.js';

function Formulario({ usu, roles, onCerrar, onGuardado }) {
  const toast = useToast();
  const [f, setF] = useState({ nombre: usu?.nombre ?? '', apellido: usu?.apellido ?? '', correo: usu?.correo ?? '', id_rol: usu?.id_rol ?? roles.find((r) => r.nombre === 'vendedor')?.id_rol ?? '', contrasena: '' });
  const [err, setErr] = useState({}); const [msg, setMsg] = useState(''); const [cargando, setCargando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function guardar(e) {
    e.preventDefault(); setCargando(true); setErr({}); setMsg('');
    const cuerpo = { ...f, id_rol: Number(f.id_rol) };
    if (usu && !cuerpo.contrasena) delete cuerpo.contrasena;
    try {
      usu ? await api.put(`/usuarios/${usu.id_usuario}`, cuerpo) : await api.post('/usuarios', cuerpo);
      toast.exito(usu ? 'Usuario actualizado.' : 'Usuario creado.'); onGuardado();
    } catch (x) { setErr(erroresDeCampos(x)); setMsg(x.message); } finally { setCargando(false); }
  }
  return (
    <Modal titulo={usu ? 'Editar usuario' : 'Nuevo usuario'} onCerrar={onCerrar}
      pie={<><Boton onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" cargando={cargando} onClick={guardar}>Guardar</Boton></>}>
      <form onSubmit={guardar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {msg && <Aviso tipo="error">{msg}</Aviso>}
        <div className="fila-form">
          <Campo etiqueta="Nombre" requerido error={err.nombre}>{(p) => <input {...p} value={f.nombre} onChange={set('nombre')} />}</Campo>
          <Campo etiqueta="Apellido" requerido error={err.apellido}>{(p) => <input {...p} value={f.apellido} onChange={set('apellido')} />}</Campo>
          <Campo etiqueta="Correo" requerido error={err.correo}>{(p) => <input {...p} type="email" value={f.correo} onChange={set('correo')} />}</Campo>
          <Campo etiqueta="Rol" requerido error={err.id_rol}>{(p) => <select {...p} value={f.id_rol} onChange={set('id_rol')}>{roles.map((r) => <option key={r.id_rol} value={r.id_rol}>{r.nombre === 'administrador' ? 'Administrador' : 'Vendedor'}</option>)}</select>}</Campo>
          <Campo etiqueta={usu ? 'Nueva contraseña (opcional)' : 'Contraseña'} requerido={!usu} error={err.contrasena} ayuda="Mínimo 8 caracteres, con letras y números.">{(p) => <input {...p} type="password" autoComplete="new-password" value={f.contrasena} onChange={set('contrasena')} />}</Campo>
        </div>
      </form>
    </Modal>
  );
}

export default function Usuarios() {
  const { usuario: yo } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState(''); const [rol, setRol] = useState(''); const [estado, setEstado] = useState(''); const [pagina, setPagina] = useState(1);
  const bq = useDebounce(q);
  const { datos, cargando, error, recargar } = useCarga(() => api.get('/usuarios', { q: bq, id_rol: rol, estado, pagina }), [bq, rol, estado, pagina]);
  const [roles, setRoles] = useState([]);
  useEffect(() => { api.get('/roles').then((r) => setRoles(r.datos)).catch(() => {}); }, []);
  const [edit, setEdit] = useState(undefined); const [cambio, setCambio] = useState(null); const [trabajando, setTrabajando] = useState(false);

  async function alternar() {
    setTrabajando(true);
    try { await api.patch(`/usuarios/${cambio.id_usuario}/estado`, { estado: !cambio.estado }); toast.exito('Estado actualizado.'); setCambio(null); recargar(); }
    catch (e) { toast.error(e.message); setCambio(null); } finally { setTrabajando(false); }
  }
  const reset = (fn) => (e) => { fn(e.target.value); setPagina(1); };
  return (
    <>
      <CabeceraPagina titulo="Usuarios" descripcion="Administra quién puede entrar al sistema y con qué rol.">
        <Boton variante="primario" icono={Plus} onClick={() => setEdit(null)} disabled={!roles.length}>Nuevo usuario</Boton>
      </CabeceraPagina>
      <div className="filtros">
        <Buscador valor={q} onChange={(v) => { setQ(v); setPagina(1); }} etiqueta="Buscar usuario" placeholder="Nombre o correo…" />
        <Campo etiqueta="Rol">{(p) => <select {...p} value={rol} onChange={reset(setRol)}><option value="">Todos</option>{roles.map((r) => <option key={r.id_rol} value={r.id_rol}>{r.nombre === 'administrador' ? 'Administrador' : 'Vendedor'}</option>)}</select>}</Campo>
        <Campo etiqueta="Estado">{(p) => <select {...p} value={estado} onChange={reset(setEstado)}><option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option></select>}</Campo>
      </div>
      {cargando ? <Cargando /> : error ? <ErrorCarga mensaje={error} onReintentar={recargar} /> : datos.datos.length === 0 ? <Vacio texto="No hay usuarios con esos filtros." /> : (
        <div className="tabla-wrap"><table>
          <caption className="solo-lectores">Lista de usuarios</caption>
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Registro</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{datos.datos.map((u) => (
            <tr key={u.id_usuario}>
              <td><strong>{u.nombre} {u.apellido}</strong> {u.id_usuario === yo.id_usuario && <Insignia tipo="info">Tú</Insignia>}</td><td>{u.correo}</td>
              <td>{u.rol === 'administrador' ? 'Administrador' : 'Vendedor'}</td><td>{fechaHora(u.fecha_registro)}</td><td><EstadoInsignia activo={u.estado} /></td>
              <td><div className="acciones">
                <Boton peq icono={Pencil} onClick={() => setEdit(u)} aria-label={`Editar ${u.nombre} ${u.apellido}`}>Editar</Boton>
                <Boton peq icono={Power} disabled={u.id_usuario === yo.id_usuario && u.estado} onClick={() => setCambio(u)} aria-label={`${u.estado ? 'Desactivar' : 'Activar'} ${u.nombre} ${u.apellido}`}>{u.estado ? 'Desactivar' : 'Activar'}</Boton>
              </div></td>
            </tr>))}</tbody>
        </table></div>
      )}
      {datos && <Paginacion pag={datos.paginacion} onCambiar={setPagina} />}
      {edit !== undefined && <Formulario usu={edit} roles={roles} onCerrar={() => setEdit(undefined)} onGuardado={() => { setEdit(undefined); recargar(); }} />}
      {cambio && <Confirmar titulo={cambio.estado ? 'Desactivar usuario' : 'Activar usuario'} mensaje={cambio.estado ? `${cambio.nombre} ${cambio.apellido} no podrá iniciar sesión ni usar el sistema. Su historial se conserva.` : `¿Activar a ${cambio.nombre} ${cambio.apellido}?`} peligro={cambio.estado} cargando={trabajando} onOk={alternar} onCancelar={() => setCambio(null)} />}
    </>
  );
}
