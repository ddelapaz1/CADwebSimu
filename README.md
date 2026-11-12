# CADwebSimu

Editor i simulador d'esquemes elèctrics de comandament i potència que funciona al navegador
(HTML, CSS i JavaScript, sense instal·lar res).

**Obrir:** https://ddelapaz1.github.io/CADwebSimu/

## Què fa
- Dibuixar esquemes amb alimentacions, fusibles, automàtics, relés tèrmics, contactors,
  interruptors, motors (trifàsic, estrella-triangle de 6 borns, monofàsic), contactes
  auxiliars i temporitzats, polsadors, finals de cursa, bobines, temporitzadors,
  teleruptors, pilots i borns, i unir-los amb cables.
- Simular: premeu els polsadors i interruptors; els contactors s'exciten, els motors giren,
  els pilots s'encenen i els cables prenen el color de la seva línia. Detecta curtcircuits,
  derivacions a terra i connexions de massa alimentades.
- Diversos esquemes oberts alhora, desfer/refer, copiar/enganxar, caixetí, formats A4/A3,
  exportar a PNG i imprimir.
- Els esquemes es desen com a fitxers `.ecs`, compatibles amb la versió per a macOS, i la
  sessió es conserva al navegador.

## Exemples
- `?ejemplo=1` arrencada directa d'un motor
- `?ejemplo=2` arrencada estrella-triangle (afegiu `&simular=1` per veure'l en marxa)
- `?ejemplo=3` inversió de gir d'un motor

## Proves
`node test/sim.test.js`
