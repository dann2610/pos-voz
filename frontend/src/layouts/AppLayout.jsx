import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Boxes, ClipboardList, LayoutDashboard, LogOut, Menu, Package, PanelLeftClose, PanelLeftOpen, Settings, ShoppingCart, Tags, Type, UserCircle, Users, UsersRound, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const ITEMS = [
  { a: '/', t: 'Panel', i: LayoutDashboard, fin: true },
  { a: '/vender', t: 'Vender', i: ShoppingCart },
  { a: '/historial', t: 'Historial de ventas', i: ClipboardList },
  { a: '/productos', t: 'Productos', i: Package },
  { a: '/inventario', t: 'Inventario', i: Boxes },
  { a: '/clientes', t: 'Clientes', i: UsersRound },
  { a: '/categorias', t: 'Categorías', i: Tags, admin: true },
  { a: '/usuarios', t: 'Usuarios', i: Users, admin: true },
  { a: '/reportes', t: 'Reportes', i: BarChart3, admin: true },
  { a: '/configuracion', t: 'Configuración', i: Settings, admin: true },
];

export default function AppLayout() {
  const { usuario, esAdmin, salir, config } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [grande, setGrande] = useState(() => { try { return localStorage.getItem('pos_texto') === 'grande'; } catch { return false; } });
  const [plegado, setPlegado] = useState(() => { try { return localStorage.getItem('pos_menu') === 'plegado'; } catch { return false; } });
  const loc = useLocation();
  const nav = useNavigate();

  useEffect(() => { try { localStorage.setItem('pos_menu', plegado ? 'plegado' : 'abierto'); } catch { /* sin almacenamiento */ } }, [plegado]);
  useEffect(() => { setAbierto(false); }, [loc.pathname]);
  useEffect(() => {
    document.documentElement.classList.toggle('texto-grande', grande);
    try { localStorage.setItem('pos_texto', grande ? 'grande' : 'normal'); } catch { /* sin almacenamiento */ }
  }, [grande]);
  useEffect(() => {
    document.title = `${config?.nombre_negocio || 'POS por voz'} · POS por voz`;
  }, [config]);

  const items = ITEMS.filter((x) => !x.admin || esAdmin);
  return (
    <div className={`app ${plegado ? 'plegado' : ''}`}>
      <a href="#contenido" className="saltar">Saltar al contenido</a>
      <header className="topbar-movil">
        <button className="icono-btn" onClick={() => setAbierto(true)} aria-label="Abrir menú" aria-expanded={abierto} aria-controls="menu-lateral"><Menu size={24} aria-hidden="true" /></button>
        <strong>{config?.nombre_negocio || 'POS por voz'}</strong>
      </header>
      <aside className={`sidebar ${abierto ? 'abierto' : ''}`} id="menu-lateral" aria-label="Navegación principal">
        <div className="marca">
          <span className="logo-cuadro"><img src="/logo-icono.png" alt="" /></span>
          <span className="txt" style={{ flex: 1 }}>POS Voz</span>
          <button className="icono-btn btn-plegar" style={{ color: '#fff' }} onClick={() => setPlegado((v) => !v)} aria-label={plegado ? 'Mostrar menú' : 'Ocultar menú'} aria-expanded={!plegado} title={plegado ? 'Mostrar menú' : 'Ocultar menú'}>{plegado ? <PanelLeftOpen size={22} aria-hidden="true" /> : <PanelLeftClose size={22} aria-hidden="true" />}</button>
          {abierto && <button className="icono-btn" style={{ color: '#fff' }} onClick={() => setAbierto(false)} aria-label="Cerrar menú"><X size={22} aria-hidden="true" /></button>}
        </div>
        <nav className="nav" aria-label="Secciones">
          {items.map((x) => <NavLink key={x.a} to={x.a} end={x.fin} title={x.t}><x.i size={20} aria-hidden="true" /><span className="txt">{x.t}</span></NavLink>)}
        </nav>
        <div className="sidebar-pie">
          <div className="usuario-mini txt"><strong>{usuario.nombre} {usuario.apellido}</strong><small>{esAdmin ? 'Administrador' : 'Vendedor'}</small></div>
          <button className="btn btn-peq" onClick={() => setGrande((g) => !g)} aria-pressed={grande} title="Texto más grande"><Type size={18} aria-hidden="true" /><span className="txt">Texto más grande</span></button>
          <button className="btn btn-peq" onClick={() => nav('/perfil')} title="Mi perfil"><UserCircle size={18} aria-hidden="true" /><span className="txt">Mi perfil</span></button>
          <button className="btn btn-peq" title="Cerrar sesión" onClick={() => { salir(); nav('/login'); }}><LogOut size={18} aria-hidden="true" /><span className="txt">Cerrar sesión</span></button>
        </div>
      </aside>
      <main className="principal" id="contenido" tabIndex={-1}>
        <div className="contenido"><Outlet /></div>
      </main>
    </div>
  );
}
