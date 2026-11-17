import { z } from 'zod';

z.config(z.locales.es());

const texto = (campo, max, min = 1) =>
  z.string({ required_error: `${campo} es obligatorio`, invalid_type_error: `${campo} debe ser texto` })
    .trim().min(min, `${campo} es obligatorio`).max(max, `${campo} admite hasta ${max} caracteres`);
const opcional = (campo, max) =>
  z.string().trim().max(max, `${campo} admite hasta ${max} caracteres`).optional().nullable()
    .transform((v) => (v === '' || v === undefined ? null : v));
const entero = (campo) => z.coerce.number({ invalid_type_error: `${campo} debe ser un número` }).int(`${campo} debe ser un entero`);
const enteroPositivo = (campo) => entero(campo).positive(`${campo} debe ser mayor que cero`);
const enteroNoNeg = (campo) => entero(campo).min(0, `${campo} no puede ser negativo`);
const dinero = (campo) => z.coerce.number({ invalid_type_error: `${campo} debe ser un número` })
  .min(0, `${campo} no puede ser negativo`).max(99999999, `${campo} es demasiado grande`)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, `${campo} admite hasta 2 decimales`);
const bool = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);
const correo = z.string().trim().toLowerCase().email('El correo no es válido').max(100);
const contrasena = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72, 'La contraseña admite hasta 72 caracteres')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'La contraseña debe incluir letras y números');
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD');

export const paginacion = { pagina: z.coerce.number().int().min(1).optional(), por_pagina: z.coerce.number().int().min(1).max(100).optional() };

export const login = z.object({ correo, contrasena: z.string().min(1, 'La contraseña es obligatoria').max(200) });
export const cambioContrasena = z.object({ actual: z.string().min(1, 'Indica tu contraseña actual'), nueva: contrasena });
export const perfil = z.object({ nombre: texto('El nombre', 60), apellido: texto('El apellido', 60) });

export const usuarioCrear = z.object({ nombre: texto('El nombre', 60), apellido: texto('El apellido', 60), correo, contrasena, id_rol: enteroPositivo('El rol') });
export const usuarioEditar = z.object({
  nombre: texto('El nombre', 60), apellido: texto('El apellido', 60), correo, id_rol: enteroPositivo('El rol'),
  contrasena: contrasena.optional(),
});
export const estadoSchema = z.object({ estado: bool });
export const usuarioFiltros = z.object({ q: z.string().trim().max(80).optional(), id_rol: z.coerce.number().int().optional(), estado: bool.optional(), ...paginacion });

export const categoria = z.object({ nombre: texto('El nombre', 60), descripcion: opcional('La descripción', 150) });
export const categoriaFiltros = z.object({ q: z.string().trim().max(80).optional(), estado: bool.optional(), ...paginacion });

export const productoCrear = z.object({
  nombre: texto('El nombre', 100), descripcion: opcional('La descripción', 150), costo: dinero('El costo').default(0), precio: dinero('El precio'),
  stock: enteroNoNeg('El stock').default(0), stock_minimo: enteroNoNeg('El stock mínimo').default(0), id_categoria: enteroPositivo('La categoría'),
});
export const productoEditar = productoCrear.omit({ stock: true });
export const productoFiltros = z.object({
  q: z.string().trim().max(80).optional(), id_categoria: z.coerce.number().int().optional(), estado: bool.optional(),
  stock_estado: z.enum(['bajo', 'agotado', 'normal']).optional(), ...paginacion,
});

export const movimiento = z.discriminatedUnion('tipo_movimiento', [
  z.object({ tipo_movimiento: z.literal('entrada'), id_producto: enteroPositivo('El producto'), cantidad: enteroPositivo('La cantidad'), motivo: texto('El motivo', 150) }),
  z.object({ tipo_movimiento: z.literal('salida'), id_producto: enteroPositivo('El producto'), cantidad: enteroPositivo('La cantidad'), motivo: texto('El motivo', 150) }),
  z.object({ tipo_movimiento: z.literal('ajuste'), id_producto: enteroPositivo('El producto'), nuevo_stock: enteroNoNeg('El nuevo stock'), motivo: texto('El motivo', 150) }),
], { errorMap: () => ({ message: 'tipo_movimiento debe ser entrada, salida o ajuste' }) });
export const movimientoFiltros = z.object({ id_producto: z.coerce.number().int().optional(), tipo: z.enum(['entrada', 'salida', 'ajuste']).optional(), desde: fecha.optional(), hasta: fecha.optional(), ...paginacion });

export const cliente = z.object({
  nombre: texto('El nombre', 60), apellido: opcional('El apellido', 60), identificacion: opcional('La identificación', 20),
  telefono: opcional('El teléfono', 20), correo: z.string().trim().toLowerCase().email('El correo no es válido').max(100).optional().nullable().or(z.literal('')).transform((v) => v || null),
  direccion: opcional('La dirección', 150),
});
export const clienteFiltros = z.object({ q: z.string().trim().max(80).optional(), estado: bool.optional(), ...paginacion });

export const ventaCrear = z.object({
  items: z.array(z.object({ id_producto: enteroPositivo('El producto'), cantidad: enteroPositivo('La cantidad').max(10000, 'Cantidad demasiado grande') }))
    .min(1, 'Agrega al menos un producto').max(100, 'Demasiados productos en una venta'),
  id_cliente: enteroPositivo('El cliente').optional().nullable(),
  metodo_pago: z.enum(['efectivo', 'transferencia', 'otro'], { errorMap: () => ({ message: 'Método de pago no válido' }) }).default('efectivo'),
  clave_idempotencia: z.string().trim().min(8).max(80).optional(),
  duracion_seg: z.coerce.number().int().min(0).max(7200).optional(),
});
export const ventaFiltros = z.object({ desde: fecha.optional(), hasta: fecha.optional(), id_usuario: z.coerce.number().int().optional(), q: z.string().trim().max(80).optional(), canal: z.enum(['manual', 'voz']).optional(), ...paginacion });

export const configuracion = z.object({
  nombre_negocio: texto('El nombre del negocio', 100),
  tasa_impuesto: z.coerce.number().min(0, 'La tasa no puede ser negativa').max(100, 'La tasa no puede superar 100').refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'La tasa admite hasta 2 decimales'),
  umbral_similitud: z.coerce.number().min(0.3).max(1),
  margen_ambiguedad: z.coerce.number().min(0).max(0.5),
  minutos_caducidad: z.coerce.number().int().min(1).max(60),
});

export const vozInterpretar = z.object({ texto: z.string().trim().min(1, 'No se recibió texto').max(300, 'El texto es demasiado largo'), id_pedido: z.string().uuid().optional() });
export const vozConfirmar = z.object({ metodo_pago: z.enum(['efectivo', 'transferencia', 'otro']).default('efectivo'), id_cliente: enteroPositivo('El cliente').optional().nullable(), duracion_seg: z.coerce.number().int().min(0).max(7200).optional() });
export const vozResolver = z.object({ indice: enteroNoNeg('El índice'), id_producto: enteroPositivo('El producto') });

export const reporteFiltros = z.object({ agrupar: z.enum(['dia', 'semana', 'mes']).default('dia'), desde: fecha.optional(), hasta: fecha.optional(), limite: z.coerce.number().int().min(1).max(50).optional() });
export const idParam = z.object({ id: z.coerce.number().int().positive('Identificador no válido') });
export const uuidParam = z.object({ id: z.string().uuid('Identificador no válido') });
