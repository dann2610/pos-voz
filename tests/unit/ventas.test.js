import test from 'node:test';
import assert from 'node:assert/strict';
import { fusionarItems, validarLineas } from '../../backend/src/services/ventas.service.js';

test('fusionar líneas repetidas del mismo producto', () => {
  assert.deepEqual(fusionarItems([{ id_producto: 1, cantidad: 2 }, { id_producto: 2, cantidad: 1 }, { id_producto: 1, cantidad: 3 }]),
    [{ id_producto: 1, cantidad: 5 }, { id_producto: 2, cantidad: 1 }]);
});
test('validación de inventario: ok, insuficiente, agotado, inactivo, inexistente', () => {
  const m = new Map([
    [1, { id_producto: 1, nombre: 'A', stock: 5, estado: true }],
    [2, { id_producto: 2, nombre: 'B', stock: 1, estado: true }],
    [3, { id_producto: 3, nombre: 'C', stock: 0, estado: true }],
    [4, { id_producto: 4, nombre: 'D', stock: 9, estado: false }],
  ]);
  assert.equal(validarLineas([{ id_producto: 1, cantidad: 5 }], m).length, 0); // justo el stock disponible
  const p = validarLineas([{ id_producto: 2, cantidad: 2 }, { id_producto: 3, cantidad: 1 }, { id_producto: 4, cantidad: 1 }, { id_producto: 9, cantidad: 1 }], m);
  assert.deepEqual(p.map((x) => x.codigo), ['STOCK_INSUFICIENTE', 'STOCK_INSUFICIENTE', 'PRODUCTO_INACTIVO', 'PRODUCTO_NO_EXISTE']);
});
