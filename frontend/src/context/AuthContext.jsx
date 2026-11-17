import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, alSesionExpirada, guardarToken, leerToken } from '../services/api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [config, setConfig] = useState(null);
  const [cargando, setCargando] = useState(!!leerToken());
  const [aviso, setAviso] = useState('');

  const cargarConfig = useCallback(async () => { try { setConfig(await api.get('/configuracion')); } catch { /* se reintenta luego */ } }, []);

  const salir = useCallback((mensaje = '') => {
    guardarToken(null); setUsuario(null); setConfig(null); setAviso(mensaje);
  }, []);

  useEffect(() => { alSesionExpirada((m) => salir(m || 'Tu sesión expiró. Inicia sesión de nuevo.')); }, [salir]);

  useEffect(() => {
    if (!leerToken()) return;
    api.get('/auth/me').then((r) => { setUsuario(r.usuario); return cargarConfig(); }).catch(() => salir()).finally(() => setCargando(false));
  }, [cargarConfig, salir]);

  const entrar = useCallback(async (correo, contrasena) => {
    const r = await api.post('/auth/login', { correo, contrasena });
    guardarToken(r.token); setUsuario(r.usuario); setAviso(''); await cargarConfig();
    return r.usuario;
  }, [cargarConfig]);

  const valor = useMemo(() => ({
    usuario, config, cargando, aviso, entrar, salir, recargarConfig: cargarConfig, setUsuario,
    esAdmin: usuario?.rol === 'administrador',
  }), [usuario, config, cargando, aviso, entrar, salir, cargarConfig]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
