# Limitaciones conocidas

**Voz**
- La precisión del reconocimiento depende del navegador (Chrome/Edge funcionan; Firefox no incluye reconocimiento; Safari es parcial), del micrófono, el ruido y el acento. **No está medida**; no se garantiza una precisión determinada.
- Requiere conexión a internet en la mayoría de navegadores y puede enviar el audio a un servicio externo del fabricante. El sistema no almacena audio, pero no puede asegurar que el audio no salga del dispositivo.
- En producción el micrófono exige HTTPS (o `localhost`).
- Idioma: español (se intenta `es-EC`, con respaldo a `es-ES` y `es-419`). La síntesis de voz usa las voces instaladas en el dispositivo.
- Las pruebas del repositorio simulan el reconocimiento; no se probó con micrófono real en el entorno de desarrollo.
- El intérprete entiende cantidades enteras hasta 100 (y docenas); no soporta fracciones ni pesos («media libra»). Un producto cuyo nombre contenga «y»/«con» puede partirse en dos; en ese caso se pide elegir o se usa el modo manual.

**Sistema**
- Sin facturación electrónica certificada, sin integración con el SRI, sin pagos en línea ni bancos, sin contabilidad.
- Stock en unidades enteras. No hay devoluciones/anulaciones de ventas (las ventas no se editan ni eliminan por regla de negocio).
- El token JWT vive en `localStorage` (vulnerable a XSS si se inyectara código en la página) y no hay *refresh tokens*; la sesión dura 8 h por defecto. El límite de intentos de login es en memoria (una sola instancia).
- Sin modo sin conexión (offline) ni sincronización.
- Probado en Linux con Node 22 y PostgreSQL 16; no se probó en Windows/macOS ni en Safari/Firefox.
- Accesibilidad: se siguieron prácticas de WCAG 2.2 (contraste, foco visible, etiquetas, teclado, objetivos táctiles, `aria-live`), pero **no se hizo una auditoría formal ni pruebas con lectores de pantalla**.
