import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { Campo } from './ui.jsx';

/** Selección de método de pago y cliente (opcional). Se usa en venta manual y por voz. */
export default function Cobro({ valor, onChange }) {
  const [clientes, setClientes] = useState([]);
  useEffect(() => { api.get('/clientes', { por_pagina: 100, estado: true }).then((r) => setClientes(r.datos)).catch(() => {}); }, []);
  return (
    <div className="fila-form">
      <Campo etiqueta="Método de pago">{(p) => (
        <select {...p} value={valor.metodo_pago} onChange={(e) => onChange({ ...valor, metodo_pago: e.target.value })}>
          <option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option>
        </select>)}
      </Campo>
      <Campo etiqueta="Cliente (opcional)">{(p) => (
        <select {...p} value={valor.id_cliente ?? ''} onChange={(e) => onChange({ ...valor, id_cliente: e.target.value ? Number(e.target.value) : null })}>
          <option value="">Consumidor final</option>
          {clientes.map((c) => <option key={c.id_cliente} value={c.id_cliente}>{c.nombre} {c.apellido ?? ''}</option>)}
        </select>)}
      </Campo>
    </div>
  );
}
