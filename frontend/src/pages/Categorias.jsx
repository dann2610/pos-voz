import { useState } from 'react';
import { Plus, Pencil, Power } from 'lucide-react';
import { api } from '../services/api.js';
import { useCarga, useDebounce } from '../hooks/useCarga.js';
import { useToast } from '../context/ToastContext.jsx';
import { Aviso, Boton, Buscador, CabeceraPagina, Campo, Cargando, Confirmar, ErrorCarga, EstadoInsignia, Modal, Paginacion, Vacio, erroresDeCampos } from '../components/ui.jsx';

function Formulario({ cat, onCerrar, onGuardado }) {
  const toast = useToast();
  const [f, setF] = useState({ nombre: cat?.nombre ?? '', descripcion: cat?.descripcion ?? '' });
  const [err, setErr] = useState({}); const [msg, setMsg] = useState(''); const [cargando, setCargando] = useState(false);
  async function guardar(e) {
    e.preventDefault(); setCargando(true); setErr({}); setMsg('');
    try {
      cat ? await api.put(`/categorias/${cat.id_categoria}`, f) : await api.post('/categorias', f);
      toast.exito(cat ? 'Categoría actualizada.' : 'Categoría creada.'); onGuardado();
    } catch (x) { setErr(erroresDeCampos(x)); setMsg(x.message); } finally { setCargando(false); }
  }
  return (
    <Modal titulo={cat ? 'Editar categoría' : 'Nueva categoría'} onCerrar={onCerrar}
      pie={<><Boton onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" cargando={cargando} onClick={guardar}>Guardar</Boton></>}>
      <form onSubmit={guardar} noValidate>
        {msg && <Aviso tipo="error">{msg}</Aviso>}
        <Campo etiqueta="Nombre" requerido error={err.nombre}>{(p) => <input {...p} value={f.nombre} maxLength={60} onChange={(e) => setF({ ...f, nombre: e.target.value })} />}</Campo>
        <Campo etiqueta="Descripción" error={err.descripcion}>{(p) => <input {...p} value={f.descripcion} maxLength={150} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />}</Campo>
      </form>
    </Modal>
  );
}

export default function Categorias() {
  const toast = useToast();
  const [q, setQ] = useState(''); const [estado, setEstado] = useState(''); const [pagina, setPagina] = useState(1);
  const bq = useDebounce(q);
  const { datos, cargando, error, recargar } = useCarga(() => api.get('/categorias', { q: bq, estado, pagina }), [bq, estado, pagina]);
  const [edit, setEdit] = useState(undefined); const [cambio, setCambio] = useState(null); const [trabajando, setTrabajando] = useState(false);

  async function alternar() {
    setTrabajando(true);
    try { await api.patch(`/categorias/${cambio.id_categoria}/estado`, { estado: !cambio.estado }); toast.exito('Estado actualizado.'); setCambio(null); recargar(); }
    catch (e) { toast.error(e.message); setCambio(null); } finally { setTrabajando(false); }
  }
  return (
    <>
      <CabeceraPagina titulo="Categorías" descripcion="Organiza tus productos por tipo.">
        <Boton variante="primario" icono={Plus} onClick={() => setEdit(null)}>Nueva categoría</Boton>
      </CabeceraPagina>
      <div className="filtros">
        <Buscador valor={q} onChange={(v) => { setQ(v); setPagina(1); }} etiqueta="Buscar categoría" placeholder="Buscar por nombre…" />
        <Campo etiqueta="Estado">{(p) => <select {...p} value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }}><option value="">Todos</option><option value="true">Activas</option><option value="false">Inactivas</option></select>}</Campo>
      </div>
      {cargando ? <Cargando /> : error ? <ErrorCarga mensaje={error} onReintentar={recargar} /> : datos.datos.length === 0 ? <Vacio texto="No hay categorías con esos filtros." /> : (
        <div className="tabla-wrap"><table>
          <caption className="solo-lectores">Lista de categorías</caption>
          <thead><tr><th>Nombre</th><th>Descripción</th><th className="num">Productos</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{datos.datos.map((c) => (
            <tr key={c.id_categoria}>
              <td><strong>{c.nombre}</strong></td><td>{c.descripcion || '—'}</td><td className="num">{c.total_productos}</td><td><EstadoInsignia activo={c.estado} /></td>
              <td><div className="acciones">
                <Boton peq icono={Pencil} onClick={() => setEdit(c)} aria-label={`Editar ${c.nombre}`}>Editar</Boton>
                <Boton peq icono={Power} onClick={() => setCambio(c)} aria-label={`${c.estado ? 'Desactivar' : 'Activar'} ${c.nombre}`}>{c.estado ? 'Desactivar' : 'Activar'}</Boton>
              </div></td>
            </tr>))}</tbody>
        </table></div>
      )}
      {datos && <Paginacion pag={datos.paginacion} onCambiar={setPagina} />}
      {edit !== undefined && <Formulario cat={edit} onCerrar={() => setEdit(undefined)} onGuardado={() => { setEdit(undefined); recargar(); }} />}
      {cambio && <Confirmar titulo={cambio.estado ? 'Desactivar categoría' : 'Activar categoría'} mensaje={`¿${cambio.estado ? 'Desactivar' : 'Activar'} la categoría "${cambio.nombre}"?`} peligro={cambio.estado} cargando={trabajando} onOk={alternar} onCancelar={() => setCambio(null)} />}
    </>
  );
}
