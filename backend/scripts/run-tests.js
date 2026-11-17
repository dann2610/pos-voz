// Ejecuta las pruebas contra una base de datos APARTE (nunca la de desarrollo).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.TEST_DATABASE_URL || (process.env.DATABASE_URL || '').replace(/\/[^/?]+(\?.*)?$/, '/pos_voz_test$1');
if (!base || /\/pos_voz(\?|$)/.test(base)) {
  console.error('Define TEST_DATABASE_URL apuntando a una base de pruebas distinta de la de desarrollo.');
  process.exit(1);
}
const entorno = {
  ...process.env, NODE_ENV: 'test', DATABASE_URL: base, LOGIN_MAX_ATTEMPTS: '1000', BCRYPT_ROUNDS: '4',
  DEMO_ADMIN_PASSWORD: 'Admin12345', DEMO_VENDEDOR_PASSWORD: 'Vende12345',
};
const filtro = process.argv.slice(2);
const dirs = filtro.length ? filtro : ['../tests/unit', '../tests/integration'];
const archivos = dirs.flatMap((d) => {
  const dir = path.join(raiz, d);
  return fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort().map((f) => path.join(dir, f));
});
const r = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...archivos], { stdio: 'inherit', env: entorno, cwd: raiz });
process.exit(r.status ?? 1);
