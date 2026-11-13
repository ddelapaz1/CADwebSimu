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
- Proteccions: davant un curtcircuit es fon el fusible o dispara l'automàtic més proper a la
  falta (selectivitat); una derivació a terra fa disparar el diferencial. Els fusibles fosos es
  canvien fent-hi clic. El relé tèrmic dispara si el motor treballa amb només dues fases.
- Comptador de polsos amb preselecció i entrada de posada a zero (R), interruptor horari amb
  programa ON/OFF cíclic, díode amb sentit de conducció i enclavament mecànic entre contactors.
- Lògica (un "1" és un node amb "+"): portes AND, OR, NOT, XOR, NAND, NOR, biestable SR, divisor
  binari, temporitzadors (connexió, pols, desconnexió, intermitent, generador de polsos), comptadors
  (simple, asc/desc, 4 bits, 4 bits asc/desc, dècades), prova, visualitza, preselector,
  decodificador i displays de 7 segments.
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
