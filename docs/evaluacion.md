# Plan de evaluación e instrumentos

> **Estado: instrumentos listos, resultados PENDIENTES.** Este repositorio no contiene participantes ni cifras de evaluación inventadas. Las pruebas automatizadas verifican que el software funciona; no miden la usabilidad ni la precisión del reconocimiento con personas reales.

## Indicadores
| Indicador | Definición | Cómo se mide | Herramienta |
|---|---|---|---|
| **WER** (tasa de error de palabras) | WER = (S + D + I) / N, con S sustituciones, D eliminaciones, I inserciones y N palabras de la referencia | Comparar el comando dicho (referencia) con el texto que devuelve el reconocedor | `node backend/scripts/wer.js docs/plantillas/wer.csv` |
| **Tasa de interpretación** | Comandos interpretados correctamente / comandos emitidos | Marcar cada comando como 1 (el sistema entendió producto y cantidad correctos) o 0 | `node backend/scripts/interpretacion.js docs/plantillas/interpretacion.csv` |
| **Tiempo de registro** (voz vs. manual) | Segundos desde el primer producto/orden hasta registrar la venta | Automático: se guarda en `ventas.duracion_seg`; se compara por canal | Pantalla *Reportes → Indicadores de voz* o `GET /api/reportes/voz` |
| **SUS** (usabilidad) | Cuestionario de 10 ítems (1–5); impares r−1, pares 5−r, suma × 2.5 | Aplicar tras las tareas; una fila por participante | `node backend/scripts/sus.js docs/plantillas/sus.csv` |
| **Tiempo de respuesta del servidor** | Mediana de 20 llamadas por endpoint | Prueba automatizada `reportes.test.js` (imprime medianas) | `npm test` |

## Procedimiento sugerido
1. Definir los participantes reales (microcomerciantes) y obtener su consentimiento informado; **registrar solo lo necesario y no guardar audio**.
2. Lista fija de comandos de prueba (p. ej., 20), con la frase de referencia de cada uno; mismas condiciones (ambiente, micrófono, navegador).
3. Cada participante realiza las mismas tareas por voz y en modo manual (orden alternado para evitar sesgo de aprendizaje).
4. Volcar referencia vs. reconocido en `wer.csv`, aciertos en `interpretacion.csv`, respuestas del cuestionario en `sus.csv`.
5. Ejecutar los scripts; reportar con n, promedio y dispersión, e indicar claramente las condiciones de la prueba.

## Resultados
| Indicador | Resultado | n |
|---|---|---|
| WER | Pendiente | — |
| Tasa de interpretación | Pendiente | — |
| Tiempo de registro voz vs. manual | Pendiente | — |
| SUS | Pendiente | — |

El algoritmo de WER y SUS está verificado con **ejemplos sintéticos** en `tests/unit/metricas.test.js` (solo prueban el cálculo, no son resultados del estudio). Umbral de referencia para SUS: 68 puntos = promedio de la literatura.
