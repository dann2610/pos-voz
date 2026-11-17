import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Aviso, Boton, Campo } from '../components/ui.jsx';

export default function Login() {
  const { entrar, aviso } = useAuth();
  const nav = useNavigate();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError(''); setCargando(true);
    try { await entrar(correo, clave); nav('/', { replace: true }); }
    catch (err) { setError(err.message); }
    finally { setCargando(false); }
  }
  return (
    <div className="login-pagina">
      <form className="login-caja" onSubmit={enviar} noValidate>
        <div className="marca"><span className="marca-logo"><img src="/logo.png" alt="POS Voz: tu negocio, más fácil" /></span></div>
        <div><h1>Iniciar sesión</h1><p className="muted">Ingresa con tu correo y contraseña.</p></div>
        {aviso && <Aviso tipo="warn">{aviso}</Aviso>}
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Campo etiqueta="Correo electrónico" requerido>{(p) => <input {...p} type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} />}</Campo>
        <Campo etiqueta="Contraseña" requerido>{(p) => <input {...p} type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />}</Campo>
        <Boton type="submit" variante="primario" grande bloque icono={LogIn} cargando={cargando} disabled={!correo || !clave}>Entrar</Boton>
      </form>
    </div>
  );
}
