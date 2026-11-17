import { Link } from 'react-router-dom';
import { CabeceraPagina } from '../components/ui.jsx';
export default function NoEncontrada() {
  return <><CabeceraPagina titulo="Página no encontrada" descripcion="La dirección no existe o no tienes acceso a ella." /><Link className="btn btn-primario" style={{ width: 'fit-content' }} to="/">Volver al panel</Link></>;
}
