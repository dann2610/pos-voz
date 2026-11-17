import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import { Cargando } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Vender from './pages/Vender.jsx';
import Historial from './pages/Historial.jsx';
import Productos from './pages/Productos.jsx';
import Categorias from './pages/Categorias.jsx';
import Inventario from './pages/Inventario.jsx';
import Clientes from './pages/Clientes.jsx';
import Usuarios from './pages/Usuarios.jsx';
import Reportes from './pages/Reportes.jsx';
import Configuracion from './pages/Configuracion.jsx';
import Perfil from './pages/Perfil.jsx';
import NoEncontrada from './pages/NoEncontrada.jsx';

function Privada({ children, soloAdmin }) {
  const { usuario, cargando, esAdmin } = useAuth();
  if (cargando) return <Cargando texto="Verificando sesión…" />;
  if (!usuario) return <Navigate to="/login" replace />;
  if (soloAdmin && !esAdmin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { usuario, cargando } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={cargando ? <Cargando /> : usuario ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<Privada><AppLayout /></Privada>}>
        <Route index element={<Dashboard />} />
        <Route path="vender" element={<Vender />} />
        <Route path="historial" element={<Historial />} />
        <Route path="productos" element={<Productos />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="categorias" element={<Privada soloAdmin><Categorias /></Privada>} />
        <Route path="usuarios" element={<Privada soloAdmin><Usuarios /></Privada>} />
        <Route path="reportes" element={<Privada soloAdmin><Reportes /></Privada>} />
        <Route path="configuracion" element={<Privada soloAdmin><Configuracion /></Privada>} />
        <Route path="perfil" element={<Perfil />} />
        <Route path="*" element={<NoEncontrada />} />
      </Route>
    </Routes>
  );
}
