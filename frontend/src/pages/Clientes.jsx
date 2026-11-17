import { useState } from 'react';
import { Plus, Pencil, Power } from 'lucide-react';
import { api } from '../services/api.js';
import { useCarga, useDebounce } from '../hooks/useCarga.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Aviso, Boton, Buscador, CabeceraPagina, Campo, Cargando, Confirmar, ErrorCarga, EstadoInsignia, Modal, Paginacion, Vacio, erroresDeCampos } from '../components/ui.jsx';

function Formulario({ cli, onCerrar, onGuardado }) {
  const toast = useToast();
  const [f, setF] = useState({ nombre: cli?.nombre ?? '', apellido: cli?.apellido ?? '', identificacion: cli?.identificacion ?? '', telefono: cli?.telefono ?? '', correo: cli?.correo ?? '', direccion: cli?.direccion ?? '' });
  const [err, setErr] = useState({}); const [msg, setMsg] = useState(''); const [cargando, setCargando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function guardar(e) {
    e.preventDefault(); setCargando(true); setErr({}); setMsg('');
    try {
      cli ? await api.put(`/clientes/${cli.id_cliente}`, f) : await api.post('/clientes', f);
      toast.exito(cli ? 'Cliente actualizado.' : 'Cliente registrado.'); onGuardado();
    } catch (x) { setErr(erroresDeCampos(x)); setMsg(x.message); } finally { setCargando(false); }
  }
  return (
    <Modal titulo={cli ? 'Editar cliente' : 'Nuevo cliente'} onCerrar={onCerrar}
      pie={<><Boton onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" cargando={cargando} onClick={guardar}>Guardar</Boton></>}>
      <form onSubmit={guardar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {msg && <Aviso tipo="error">{msg}</Aviso>}
        <div className="fila-form">
          <Campo etiqueta="Nombre" requerido error={err.nombre}>{(p) => <input {...p} value={f.nombre} onChange={set('nombre')} />}</Campo>
          <Campo etiqueta="Apellido" error={err.apellido}>{(p) => <input {...p} value={f.apellido} onChange={set('apellido')} />}</Campo>
          <Campo etiqueta="Identificación" error={err.identificacion} ayuda="Cédula o RUC (opcional)">{(p) => <input {...p} value={f.identificacion} onChange={set('identificacion')} />}</Campo>
          <Campo etiqueta="Teléfono" error={err.telefono}>{(p) => <input {...p} type="tel" value={f.telefono} onChange={set('telefono')} />}</Campo>
          <Campo etiqueta="Correo" error={err.correo}>{(p) => <input {...p} type="email" value={f.correo} onChange={set('correo')} />}</Campo>
          <Campo etiqueta="Dirección" error={err.direccion}>{(p) => <input {...p} value={f.direccion} onChange={set('direccion')} />}</Campo>
        </div>
      </form>
    </Modal>
  );
}

export default function Clientes() {
  const { esAdmin } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState(''); const [estado, setEstado] = useState(''); const [pagina, setPagina] = useState(1);
  const bq = useDebounce(q);
  const { datos, cargando, error, recargar } = useCarga(() => api.get('/clientes', { q: bq, estado: esAdmin ? estado : '', pagina }), [bq, estado, pagina]);
  const [edit, setEdit] = useState(undefined); const [cambio, setCambio] = useState(null); const [trabajando, setTrabajando] = useState(false);
  async function alternar() {
    setTrabajando(true);
    try { await api.patch(`/clientes/${cambio.id_cliente}/estado`, { estado: !cambio.estado }); toast.exito('Estado actualizado.'); setCambio(null); recargar(); }
    catch (e) { toast.error(e.message); setCambio(null); } finally { setTrabajando(false); }
  }
  return (
    <>
      <CabeceraPagina titulo="Clientes" descripcion="Registrar un cliente en la venta es opcional.">
        <Boton variante="primario" icono={Plus} onClick={() => setEdit(null)}>Nuevo cliente</Boton>
      </CabeceraPagina>
      {!esAdmin && <Aviso tipo="info">Por privacidad, tu rol muestra solo el nombre y una identificación parcial. El administrador gestiona los demás datos.</Aviso>}
      <div className="filtros">
        <Buscador valor={q} onChange={(v) => { setQ(v); setPagina(1); }} etiqueta="Buscar cliente" placeholder="Nombre o identificación…" />
        {esAdmin && <Campo etiqueta="Estado">{(p) => <select {...p} value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }}><option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option></select>}</Campo>}
      </div>
      {cargando ? <Cargando /> : error ? <ErrorCarga mensaje={error} onReintentar={recargar} /> : datos.datos.length === 0 ? <Vacio texto="No hay clientes con esos filtros." /> : (
        <div className="tabla-wrap"><table>
          <caption className="solo-lectores">Lista de clientes</caption>
          <thead><tr><th>Cliente</th><th>Identificación</th>{esAdmin && <><th>Teléfono</th><th>Correo</th><th>Estado</th><th>Acciones</th></>}</tr></thead>
          <tbody>{datos.datos.map((c) => (
            <tr key={c.id_cliente}>
              <td><strong>{c.nombre} {c.apellido}</strong></td><td>{c.identificacion || '—'}</td>
              {esAdmin && <>
                <td>{c.telefono || '—'}</td><td>{c.correo || '—'}</td><td><EstadoInsignia activo={c.estado} /></td>
                <td><div className="acciones">
                  <Boton peq icono={Pencil} onClick={() => setEdit(c)} aria-label={`Editar ${c.nombre}`}>Editar</Boton>
                  <Boton peq icono={Power} onClick={() => setCambio(c)} aria-label={`${c.estado ? 'Desactivar' : 'Activar'} ${c.nombre}`}>{c.estado ? 'Desactivar' : 'Activar'}</Boton>
                </div></td></>}
            </tr>))}</tbody>
        </table></div>
      )}
      {datos && <Paginacion pag={datos.paginacion} onCambiar={setPagina} />}
      {edit !== undefined && <Formulario cli={edit} onCerrar={() => setEdit(undefined)} onGuardado={() => { setEdit(undefined); recargar(); }} />}
      {cambio && <Confirmar titulo={cambio.estado ? 'Desactivar cliente' : 'Activar cliente'} mensaje={`¿${cambio.estado ? 'Desactivar' : 'Activar'} a ${cambio.nombre} ${cambio.apellido ?? ''}? Sus ventas anteriores se conservan.`} peligro={cambio.estado} cargando={trabajando} onOk={alternar} onCancelar={() => setCambio(null)} />}
    </>
  );
}
