const { chromium } = require('playwright');
// Prueba de extremo a extremo con un navegador real (Playwright). OPCIONAL: requiere `npm i -D playwright` y la app en marcha
// con la BD demo recién creada (npm run db:init:demo) y SERVE_FRONTEND=true (o ajusta BASE).
// IMPORTANTE: el reconocimiento de voz está SIMULADO (clase MockRec): se prueba la integración de la interfaz con la API,
// no la precisión del reconocimiento real del navegador.
const BASE = process.env.BASE_URL || 'http://localhost:4000';
const OUT = process.argv[2] || './capturas';
require('fs').mkdirSync(OUT, { recursive: true });
const MOCK = `
class MockRec { constructor(){ this.lang='es'; }
  start(){ this.onstart && this.onstart(); setTimeout(()=>{ const t = window.__dicho||''; const r=[{0:{transcript:t},isFinal:true,length:1}]; this.onresult && this.onresult({resultIndex:0,results:r}); this.onend && this.onend(); }, 250); }
  stop(){} abort(){} }
window.SpeechRecognition = MockRec; window.webkitSpeechRecognition = MockRec;
window.__hablado = [];
window.speechSynthesis.speak = (u)=>{ window.__hablado.push(u.text); u.onend && u.onend(); };
`;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALLA') + ' ' + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-EC' });
  await ctx.addInitScript(MOCK);
  const p = await ctx.newPage();
  p.setDefaultTimeout(8000);
  const errores = []; p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); }); p.on('pageerror', (e) => errores.push(String(e)));
  await p.goto(BASE + '/');
  await p.waitForURL('**/login');
  await p.getByLabel('Correo electrónico').fill('admin@demo.com');
  await p.getByLabel('Contraseña').fill('mala');
  await p.getByRole('button', { name: 'Entrar' }).click();
  await p.getByText('Correo o contraseña incorrectos').waitFor();
  ok(true, 'login con clave errónea muestra error');
  await p.getByLabel('Contraseña').fill('Admin12345');
  await p.getByRole('button', { name: 'Entrar' }).click();
  await p.getByRole('heading', { name: /Hola, Admin/ }).waitFor();
  await p.screenshot({ path: `${OUT}/01-dashboard.png`, fullPage: true });
  ok(true, 'login admin y dashboard');

  await p.getByRole('link', { name: 'Vender' }).click();
  await p.evaluate(() => { window.__dicho = 'vender dos coca kola 500 y un arroz'; });
  await p.getByRole('button', { name: /Hablar/ }).click();
  await p.getByText('Pedido por confirmar').waitFor();
  ok(await p.getByText('Elige una opción').count() > 0, 'voz: "arroz" ambiguo pide elegir');
  ok(await p.getByRole('button', { name: 'Confirmar venta' }).isDisabled(), 'voz: confirmar bloqueado mientras hay ambigüedad');
  await p.screenshot({ path: `${OUT}/02-voz-ambiguo.png`, fullPage: true });
  await p.getByRole('button', { name: /1\. Arroz Flor/ }).click();
  await p.waitForFunction(() => !document.querySelector('.pedido-item.ambiguo'));
  ok(await p.getByRole('button', { name: 'Confirmar venta' }).isEnabled(), 'voz: tras elegir queda listo para confirmar');
  const habla = await p.evaluate(() => window.__hablado.join(' | '));
  ok(/Confirmas/.test(habla) || /Cuál/.test(habla), 'voz: respuestas habladas -> ' + habla.slice(-90));
  await p.screenshot({ path: `${OUT}/03-voz-listo.png`, fullPage: true });
  await p.getByRole('button', { name: 'Confirmar venta' }).click();
  await p.getByText(/Venta #\d+ registrada por/).first().waitFor();
  ok(true, 'voz: venta confirmada');
  await p.screenshot({ path: `${OUT}/04-voz-venta.png`, fullPage: true });

  await p.evaluate(() => { window.__dicho = 'dame tres pepsi'; });
  await p.getByRole('button', { name: /Hablar/ }).click();
  await p.getByText('Pedido por confirmar').waitFor();
  await p.evaluate(() => { window.__dicho = 'cancelar el pedido actual'; });
  await p.getByRole('button', { name: /Hablar/ }).click();
  await p.getByText('Pedido por confirmar').waitFor({ state: 'detached' });
  ok(true, 'voz: cancelar por voz elimina el pedido');

  await p.evaluate(() => { window.__dicho = '¿cuánto cuesta la leche vita funda?'; });
  await p.getByRole('button', { name: /Hablar/ }).click();
  await p.getByText(/Leche Vita.*(cuesta|1,05)/).waitFor();
  ok(true, 'voz: consulta de precio');

  await p.getByRole('button', { name: 'Manual' }).click();
  await p.getByRole('button', { name: /^Galletas Ricas/ }).click();
  await p.getByRole('button', { name: /^Galletas Ricas/ }).click();
  await p.getByRole('button', { name: 'Registrar venta' }).click();
  await p.getByText(/Venta #\d+ registrada/).first().waitFor();
  await p.screenshot({ path: `${OUT}/05-manual.png`, fullPage: true });
  ok(true, 'manual: venta registrada');

  for (const [n, f] of [['Productos', '06-productos'], ['Inventario', '07-inventario'], ['Historial de ventas', '08-historial'], ['Reportes', '09-reportes'], ['Usuarios', '10-usuarios'], ['Configuración', '11-config'], ['Clientes', '12-clientes'], ['Categorías', '13-categorias']]) {
    await p.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: n }).click();
    await p.getByRole('heading', { level: 1 }).waitFor();
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/${f}.png`, fullPage: true });
  }
  ok(true, 'pantallas recorridas');
  await p.getByRole('navigation', { name: 'Secciones' }).getByRole('link', { name: 'Reportes' }).click();
  await p.getByText(/en 2 venta/).waitFor();
  ok(true, 'reportes con datos reales (2 ventas)');

  const m = await b.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-EC' });
  await m.addInitScript(MOCK);
  const pm = await m.newPage(); pm.setDefaultTimeout(8000);
  await pm.goto(BASE + '/login');
  await pm.getByLabel('Correo electrónico').fill('vendedor@demo.com');
  await pm.getByLabel('Contraseña').fill('Vende12345');
  await pm.getByRole('button', { name: 'Entrar' }).click();
  await pm.getByRole('heading', { name: /Hola, Vendedor/ }).waitFor();
  await pm.screenshot({ path: `${OUT}/14-movil-dashboard.png`, fullPage: true });
  await pm.getByRole('button', { name: 'Abrir menú' }).click();
  ok(await pm.getByRole('link', { name: 'Usuarios' }).count() === 0, 'vendedor no ve opciones de administrador');
  await pm.screenshot({ path: `${OUT}/15-movil-menu.png` });
  await pm.getByRole('link', { name: 'Vender' }).click();
  await pm.waitForTimeout(500);
  await pm.screenshot({ path: `${OUT}/16-movil-vender.png`, fullPage: true });
  const overflow = await pm.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!overflow, 'móvil: sin desbordamiento horizontal');
  await pm.goto(BASE + '/usuarios');
  await pm.waitForURL(BASE + '/');
  ok(true, 'vendedor redirigido al intentar abrir /usuarios');

  const s = await b.newContext({ viewport: { width: 1100, height: 800 } });
  await s.addInitScript('delete window.SpeechRecognition; delete window.webkitSpeechRecognition;');
  const ps = await s.newPage(); ps.setDefaultTimeout(8000);
  await ps.goto(BASE + '/login');
  await ps.getByLabel('Correo electrónico').fill('vendedor@demo.com');
  await ps.getByLabel('Contraseña').fill('Vende12345');
  await ps.getByRole('button', { name: 'Entrar' }).click();
  await ps.getByRole('link', { name: 'Vender' }).click();
  await ps.getByText(/no admite reconocimiento de voz/).waitFor();
  ok(await ps.getByRole('button', { name: /Hablar/ }).isDisabled(), 'sin soporte: micrófono deshabilitado y aviso visible');
  await ps.getByLabel('Escribir o corregir el comando').fill('vender un queso kiosko');
  await ps.getByRole('button', { name: 'Enviar' }).click();
  await ps.getByText('Pedido por confirmar').waitFor();
  await ps.getByRole('button', { name: 'Confirmar venta' }).click();
  await ps.getByText(/Venta #\d+ registrada por/).first().waitFor();
  ok(true, 'sin soporte de voz: el comando escrito funciona hasta registrar la venta');
  await ps.screenshot({ path: `${OUT}/17-sin-voz.png`, fullPage: true });

  // Se ignoran: fuentes externas bloqueadas por la red y el 401 provocado a propósito con la contraseña errónea.
  const reales = errores.filter((e) => !/ERR_TUNNEL|ERR_INTERNET|ERR_NAME|status of 401/.test(e));
  ok(reales.length === 0, 'sin errores de consola inesperados' + (reales.length ? ': ' + reales.join(' || ').slice(0, 300) : ''));
  await b.close();
})().catch((e) => { console.error('EXCEPCION', e.message.split('\n')[0]); process.exit(1); });
