# SimuLAB

Editor y simulador de esquemas eléctricos de mando y potencia que funciona en el navegador
(HTML, CSS y JavaScript, sin instalar nada).

**Abrir:** https://ddelapaz1.github.io/SimuLAB/

## Qué hace
- Dibujar esquemas con alimentaciones, fusibles, automáticos, relés térmicos, contactores,
  interruptores, motores (trifásico, estrella-triángulo de 6 bornes, monofásico), contactos
  auxiliares y temporizados, pulsadores, finales de carrera, bobinas, temporizadores,
  telerruptores, pilotos y bornes, y unirlos con cables.
- Simular: pulse los pulsadores e interruptores; los contactores se excitan, los motores giran,
  los pilotos se encienden y los cables toman el color de su línea. Detecta cortocircuitos,
  derivaciones a tierra y conexiones de masa alimentadas.
- Varios esquemas abiertos a la vez, deshacer/rehacer, copiar/pegar, cajetín, formatos A4/A3,
  exportar a PNG e imprimir.
- Los esquemas se guardan como archivos `.ecs`, compatibles con la versión para macOS, y la
  sesión se conserva en el navegador.

## Ejemplos
- `?ejemplo=1` arranque directo de un motor
- `?ejemplo=2` arranque estrella-triángulo (añada `&simular=1` para verlo en marcha)

## Pruebas
`node test/sim.test.js`
