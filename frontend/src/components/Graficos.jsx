import { etiquetaDia } from '../utils/format.js';

/** Barras verticales en SVG. Incluye una tabla equivalente para lectores de pantalla. */
export function BarrasVerticales({ datos, titulo, formato = (v) => v, altura = 220 }) {
  const w = 640; const pad = { t: 16, r: 8, b: 34, l: 48 };
  const max = Math.max(1, ...datos.map((d) => Number(d.valor)));
  const ancho = (w - pad.l - pad.r) / Math.max(1, datos.length);
  const y = (v) => pad.t + (altura - pad.t - pad.b) * (1 - v / max);
  const marcas = [0, 0.5, 1].map((f) => max * f);
  return (
    <figure className="grafico" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${w} ${altura}`} role="img" aria-label={titulo}>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={pad.l} x2={w - pad.r} y1={y(m)} y2={y(m)} stroke="#d5dde4" strokeWidth="1" />
            <text x={pad.l - 6} y={y(m) + 4} textAnchor="end" fontSize="11" fill="#4b5b6a">{formato(m)}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const bw = Math.min(46, ancho * 0.62);
          const x = pad.l + i * ancho + (ancho - bw) / 2;
          const yy = y(Number(d.valor));
          return (
            <g key={d.etiqueta}>
              <rect x={x} y={yy} width={bw} height={Math.max(2, altura - pad.b - yy)} rx="4" fill="#1558b0"><title>{`${d.etiqueta}: ${formato(d.valor)}`}</title></rect>
              <text x={x + bw / 2} y={altura - 12} textAnchor="middle" fontSize="11" fill="#4b5b6a">{d.etiqueta}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="solo-lectores">{titulo}</figcaption>
      <table className="solo-lectores"><caption>{titulo}</caption><thead><tr><th>Etiqueta</th><th>Valor</th></tr></thead>
        <tbody>{datos.map((d) => <tr key={d.etiqueta}><td>{d.etiqueta}</td><td>{formato(d.valor)}</td></tr>)}</tbody></table>
    </figure>
  );
}

export function BarrasHorizontales({ datos, titulo, formato = (v) => v }) {
  const max = Math.max(1, ...datos.map((d) => Number(d.valor)));
  return (
    <div role="list" aria-label={titulo}>
      {datos.map((d) => (
        <div className="barra-h" role="listitem" key={d.etiqueta}>
          <span title={d.etiqueta} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.etiqueta}</span>
          <div className="pista" aria-hidden="true"><div className="relleno" style={{ width: `${(Number(d.valor) / max) * 100}%` }} /></div>
          <strong>{formato(d.valor)}</strong>
        </div>
      ))}
    </div>
  );
}

export const serieDias = (filas, campo = 'total') => filas.map((f) => ({ etiqueta: etiquetaDia(f.periodo), valor: Number(f[campo]) }));
