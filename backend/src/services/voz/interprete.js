// Intérprete de comandos de voz (función pura: texto + catálogo -> estructura). Sin acceso a la BD.
import { normalizar, RUIDO, SEPARADORES } from './texto.js';
import { leerNumero } from './cantidades.js';
import { indexarCatalogo, buscarProducto } from './matching.js';

const ORDINALES = { primero: 0, primera: 0, uno: 0, segundo: 1, segunda: 1, dos: 1, tercero: 2, tercera: 2, tres: 2, cuarto: 3, cuarta: 3, cuatro: 3, quinto: 4, quinta: 4, cinco: 4 };

const RE = {
  cancelar: /^(?:no\s+)?(?:cancel\w*|anul\w*|olvid\w*|borr\w*|descart\w*|deja\w*\s+(?:eso|todo))\b/,
  confirmar: /^(?:si\s+)?(?:confirm\w*|acept\w*|esta bien|correcto|listo|dale|de acuerdo|adelante|proced\w*|cobra\w*|si|ok|okey)\b/,
  precio: /\b(?:cuanto\s+(?:cuesta|cuestan|vale|valen|cobran|sale|salen|es)|a\s+como\s+(?:esta|estan|es|son)|que\s+precio\s+(?:tiene|tienen)|precio\s+(?:de|del))\b/,
  stock: /\b(?:cuant[oa]s?\s+(?:unidades?\s+)?(?:hay|quedan?|tengo|tenemos|existen)|cuant[oa]s?\s+(?:me\s+)?quedan?|stock|existencias?|disponibles?|quedan?)\b/,
  agregar: /^(?:agrega\w*|anade|anadir|suma\w*|ademas|tambien|otro|otra)\b/,
};

/** Quita del texto la expresión de la intención y deja la frase del producto. */
function fraseProducto(norm) {
  let t = norm.replace(RE.precio, ' ').replace(RE.stock, ' ');
  t = t.replace(/\b(?:cuant[oa]s?|cuesta|cuestan|vale|valen|hay|tengo|tenemos|queda|quedan|unidades?|existen|de|del|la|el|los|las|un|una|que|precio|tiene|tienen|tienes|por|favor)\b/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

/** Divide una frase de venta en pedazos {cantidad, palabras[]}. */
export function segmentarItems(norm) {
  const toks = norm.split(' ').filter(Boolean);
  const items = [];
  let actual = null;
  const cerrar = () => { if (actual && actual.palabras.length) items.push(actual); actual = null; };
  for (let i = 0; i < toks.length; ) {
    const t = toks[i];
    const num = leerNumero(toks, i);
    // "coca cola 500": un número en dígitos al final de un renglón es parte del nombre/presentación, no una cantidad nueva.
    const finDeRenglon = i + (num?.consumidos ?? 1) >= toks.length || SEPARADORES.has(toks[i + (num?.consumidos ?? 1)]);
    if (num && /^\d+$/.test(t) && actual && actual.palabras.length && finDeRenglon) {
      actual.palabras.push(t); i += 1; continue;
    }
    if (num && !(num.valor === 0)) {
      // "uno/una" como artículo dentro del nombre ("jabon una") es raro; se trata como cantidad.
      cerrar();
      actual = { cantidad: num.valor, palabras: [], explicita: true };
      i += num.consumidos;
      continue;
    }
    if (SEPARADORES.has(t)) { cerrar(); i += 1; continue; }
    if (RUIDO.has(t)) { i += 1; continue; }
    if (!actual) actual = { cantidad: 1, palabras: [], explicita: false };
    actual.palabras.push(t);
    i += 1;
  }
  cerrar();
  return items;
}

function estadoItem(it, r) {
  const base = { texto: it.palabras.join(' '), cantidad: it.cantidad };
  if (r.estado === 'no_encontrado') {
    return { ...base, estado: 'no_encontrado', opciones: r.sugerencias.map(op), mensaje: `No encontré "${base.texto}".` };
  }
  if (r.estado === 'ambiguo') {
    return { ...base, estado: 'ambiguo', opciones: r.opciones.map(op), mensaje: `"${base.texto}" puede ser varios productos. Elige uno.` };
  }
  return conProducto(base, r.mejor.producto, r.mejor.score);
}
const op = (o) => ({ id_producto: o.producto.id_producto, nombre: o.producto.nombre, descripcion: o.producto.descripcion ?? null, precio: o.producto.precio, stock: o.producto.stock, score: o.score });

/** Asigna un producto a un renglón y decide si hay stock. */
export function conProducto(base, p, score) {
  const r = { ...base, id_producto: p.id_producto, nombre: p.nombre, descripcion: p.descripcion ?? null, precio: p.precio, stock: p.stock, score, opciones: [] };
  if (p.stock < base.cantidad) {
    return { ...r, estado: 'sin_stock', mensaje: p.stock === 0 ? `${p.nombre} está agotado.` : `Solo quedan ${p.stock} de ${p.nombre}; pediste ${base.cantidad}.` };
  }
  return { ...r, estado: 'ok', mensaje: null };
}

/**
 * interpretar(texto, productosActivos, { umbral, margen }, { hayPedidoPendiente })
 * -> { intent, texto_normalizado, items?, consulta?, indice?, agregar? }
 */
export function interpretar(texto, productos, cfg = {}, ctx = {}) {
  const norm = normalizar(texto);
  if (!norm) return { intent: 'desconocido', texto_normalizado: norm };

  if (RE.cancelar.test(norm)) return { intent: 'cancelar', texto_normalizado: norm };

  const soloOrdinal = norm.replace(/\b(?:el|la|opcion|numero|quiero|dame|elijo|ese|esa)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (ctx.hayPedidoPendiente && soloOrdinal in ORDINALES) {
    return { intent: 'seleccion', indice: ORDINALES[soloOrdinal], texto_normalizado: norm };
  }
  if (RE.confirmar.test(norm) && !/\d/.test(norm) && norm.split(' ').length <= 6) return { intent: 'confirmar', texto_normalizado: norm };

  const indice = indexarCatalogo(productos);
  const buscar = (frase) => buscarProducto(frase, indice, { umbral: cfg.umbral, margen: cfg.margen });

  const esPrecio = RE.precio.test(norm);
  const esStock = RE.stock.test(norm) && !esPrecio;
  if (esPrecio || esStock) {
    const frase = fraseProducto(norm);
    const r = buscar(frase);
    const intent = esPrecio ? 'consultar_precio' : 'consultar_stock';
    if (r.estado === 'ok') return { intent, texto_normalizado: norm, consulta: { estado: 'ok', frase, producto: r.mejor.producto } };
    return { intent, texto_normalizado: norm, consulta: { estado: r.estado, frase, opciones: (r.estado === 'ambiguo' ? r.opciones : r.sugerencias).map(op) } };
  }

  const agregar = RE.agregar.test(norm);
  const piezas = segmentarItems(norm);
  if (!piezas.length) return { intent: 'desconocido', texto_normalizado: norm };
  const items = piezas.map((it) => estadoItem(it, buscar(it.palabras.join(' '))));
  // Sin verbo de venta ni cantidad y sin ningún producto reconocido: no es un pedido ("hola buenas").
  const hayVerbo = /\b(?:vend\w*|dame|deme|quiero|necesito|agrega\w*|ponme|cobra\w*|registra\w*|anade|anadir)\b/.test(norm);
  if (!hayVerbo && !piezas.some((p) => p.explicita) && items.every((i) => i.estado === 'no_encontrado')) {
    return { intent: 'desconocido', texto_normalizado: norm };
  }
  return { intent: 'vender', texto_normalizado: norm, items, agregar };
}
