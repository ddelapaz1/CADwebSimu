// SimuLAB — teaching notes for every element: what it is, characteristics,
// how it works and how the simulator treats it. Shown in the properties panel
// under "Més informació".
"use strict";
(function (SL) {
  // ---------------------------------------------------------------- shared pieces
  var CONTACT = {
    NO: "Contacte normalment obert (NA): en repòs no deixa passar el corrent i tanca quan s'acciona. Borns habituals 13-14 (3-4 en polsadors).",
    NC: "Contacte normalment tancat (NC): en repòs deixa passar el corrent i obre quan s'acciona. Borns habituals 21-22 (1-2 en polsadors).",
    NONC: "Dos contactes en un mateix element, un NA i un NC, que canvien alhora quan s'acciona.",
    CO: "Contacte commutat (COM): un born comú que en repòs connecta amb el contacte NC i, en accionar-se, passa al NA. Borns habituals 11-12-14.",
  };
  function contactType(kind) {
    if (/NONC$/.test(kind)) return CONTACT.NONC;
    if (/CO$/.test(kind)) return CONTACT.CO;
    if (/NC$/.test(kind)) return CONTACT.NC;
    if (/NO$/.test(kind)) return CONTACT.NO;
    return null;
  }
  function polesText(kind) {
    var m = /(\d)(N?)$/.exec(kind);
    if (!m) return null;
    var n = +m[1], names = ["", "unipolar", "bipolar", "tripolar", "tetrapolar"];
    return m[2] ? "Versió de " + n + " fase" + (n > 1 ? "s" : "") + " + neutre (" + (n + 1) + " pols): el neutre també es talla."
      : "Versió " + (names[n] || n + " pols") + " (" + n + " pol" + (n > 1 ? "s" : "") + ").";
  }

  var I = {};

  // ---------------------------------------------------------------- supplies
  I.Feed = {
    what: "Punt d'alimentació de l'esquema: representa l'arribada de la xarxa o d'una font.",
    specs: ["Xarxa de baixa tensió: 230 V entre fase i neutre i 400 V entre fases (50 Hz).",
      "Colors normalitzats dels conductors: fases marró, negre i gris; neutre blau; protecció (PE) verd-groc.",
      "En corrent continu, el positiu (+) i el negatiu (−); en maniobra solen ser 24 V CC."],
    how: "Cada born fixa el potencial del conductor que hi connecteu. Tot el que hi estigui unit sense passar per un contacte obert queda al mateix potencial.",
    sim: "Els conductors prenen el color del seu potencial. Si dos potencials diferents es troben, hi ha un curtcircuit; si una fase toca PE, és una derivació a terra.",
  };
  I.Ground = { what: "Presa de terra (conductor de protecció PE).",
    specs: ["Uneix les masses metàl·liques dels aparells amb la terra de l'edifici.", "Color verd-groc; no s'ha de tallar mai."],
    how: "En cas de defecte d'aïllament, el corrent de fuita circula cap a terra i fa disparar el diferencial abans que algú toqui una massa amb tensió.",
    sim: "Una fase que arriba a PE provoca una derivació a terra: dispara el diferencial si n'hi ha, i si no s'atura la simulació." };
  I.Transformer1 = { what: "Transformador monofàsic: canvia el valor de la tensió alterna, per exemple de 400 V o 230 V a 24 V per al circuit de maniobra.",
    specs: ["Primari (1-2) i secundari (3-4) aïllats galvànicament.", "Potència en VA; tensions de primari i secundari a la placa.", "El secundari s'ha de protegir amb fusible o automàtic."],
    how: "El primari crea un camp magnètic variable al nucli i aquest indueix una tensió al secundari proporcional a la relació d'espires.",
    sim: "Quan el primari rep dues fases o fase i neutre, el secundari dona una sortida L-N." };
  I.Transformer3 = { what: "Transformador trifàsic: adapta la tensió d'una xarxa de tres fases.",
    specs: ["Primari 1-2-3 i secundari 4-5-6.", "Connexions habituals estrella o triangle (Dyn11, Yyn0...)."],
    how: "Tres columnes magnètiques, una per fase, transformen cada fase com un transformador monofàsic.",
    sim: "Si el primari rep les tres fases, el secundari reprodueix L1-L2-L3 amb la mateixa seqüència." };
  I.Diode = { what: "Díode: semiconductor que deixa passar el corrent en un sol sentit, d'ànode (1) a càtode (2).",
    specs: ["Caiguda de tensió en conducció d'uns 0,7 V (silici).", "Corrent màxim i tensió inversa màxima a la fitxa tècnica.", "Usos: rectificar, protegir contra polaritat inversa, díode de lliure circulació en bobines de CC."],
    how: "Amb l'ànode més positiu que el càtode (polarització directa) condueix; al revés (polarització inversa) bloqueja.",
    sim: "El «+» passa de l'ànode al càtode i el «−» del càtode a l'ànode; al revés queda bloquejat. En alterna condueix mitja ona." };
  I.Rectifier = { what: "Pont rectificador: converteix corrent altern en corrent continu.",
    specs: ["Quatre díodes en pont (Graetz).", "La sortida és pulsant; sovint es filtra amb un condensador."],
    how: "A cada semicicle condueixen dos díodes diferents, de manera que a la sortida el corrent sempre té el mateix sentit.",
    sim: "Amb alimentació alterna a l'entrada, dona «+» i «−» a la sortida." };
  I.PowerSupply1 = { what: "Font d'alimentació commutada: obté una tensió contínua estable (normalment 24 V CC) a partir de la xarxa.",
    specs: ["Entrada 230 V CA, sortida 24 V CC regulada.", "Corrent màxim de sortida en A; molts models tenen protecció contra curtcircuit."],
    how: "Rectifica la xarxa, la commuta a alta freqüència, la transforma i la torna a rectificar i filtrar.",
    sim: "Amb fase i neutre a l'entrada, la sortida dona «+» i «−»." };
  I.PowerSupply3 = { what: "Font d'alimentació trifàsica: dona tensió contínua a partir de tres fases.", specs: ["Per a potències més grans; entrada 3 × 400 V."],
    how: "Com la monofàsica, però rectifica les tres fases.", sim: "Amb les tres fases a l'entrada dona «+» i «−»." };
  I.Battery = { what: "Bateria: font de corrent continu que emmagatzema energia química.", specs: ["Tensió nominal (12 V, 24 V...) i capacitat en Ah."],
    how: "Dona tensió contínua sense necessitat de xarxa.", sim: "Fixa «+» i «−» als seus borns." };
  I.Socket = { what: "Presa de corrent: punt on es connecten aparells amb clavilla.", specs: ["Tipus Schuko 16 A amb presa de terra en habitatges."],
    how: "Dona fase, neutre i protecció a l'aparell que s'hi connecta.", sim: "Es comporta com una càrrega: rep tensió quan hi arriben fase i neutre." };

  // ---------------------------------------------------------------- protections
  I.Fuse = { what: "Fusible: protecció contra curtcircuits i sobrecàrregues que es fon i obre el circuit quan hi passa massa corrent.",
    specs: ["Calibre (corrent nominal) en A i poder de tall en kA.", "Tipus gG (ús general) o aM (acompanyament de motors).", "Un cop fos s'ha de substituir."],
    how: "El filament calibrat s'escalfa amb el corrent; si el corrent supera el calibre durant prou temps, es fon i talla el circuit.",
    sim: "En un curtcircuit es fon el fusible més proper a la falta i la resta continua amb tensió. Feu-hi clic durant la simulació per canviar-lo." };
  I.FuseSw = { what: "Fusible seccionable (portafusibles seccionador): fusible muntat en una base que es pot obrir a mà.",
    specs: ["Permet seccionar el circuit sense eines per fer manteniment.", "S'ha d'obrir sense càrrega."],
    how: "Funciona com un fusible i, a més, s'obre a mà per deixar el circuit sense tensió.",
    sim: "Feu-hi clic per obrir-lo o tancar-lo; també es dispara amb un curtcircuit." };
  I.Auto = { what: "Interruptor automàtic magnetotèrmic (PIA): protegeix la línia contra sobrecàrregues i curtcircuits i es pot rearmar.",
    specs: ["Corrent nominal (6, 10, 16, 20... A) i corba de dispar B, C o D.", "Corba C: dispar magnètic entre 5 i 10 vegades el corrent nominal (ús general).", "Poder de tall (6 kA, 10 kA...)."],
    how: "La part tèrmica (bilàmina) talla les sobrecàrregues amb un cert retard; la part magnètica (bobina) talla els curtcircuits gairebé a l'instant.",
    sim: "Comença obert. Feu-hi clic per tancar-lo. Dispara sol en un curtcircuit i queda indicat com a «disparat»." };
  I.Rcd = { what: "Interruptor diferencial: protegeix les persones contra contactes indirectes i fuites a terra.",
    specs: ["Sensibilitat 30 mA en circuits d'ús general (alta sensibilitat).", "Tipus AC, A o B segons la forma del corrent de fuita.", "No protegeix contra sobrecàrregues: va acompanyat d'automàtics."],
    how: "Compara el corrent que entra per les fases amb el que torna pel neutre. Si la diferència (fuita) supera la sensibilitat, obre el circuit.",
    sim: "Dispara quan una fase arriba a PE (derivació a terra). Un curtcircuit entre fase i neutre no el fa disparar." };
  I.ThermalRelay3 = { what: "Relé tèrmic: protegeix el motor contra sobrecàrregues i contra el funcionament amb una fase de menys.",
    specs: ["S'ajusta al corrent nominal del motor (escala a la part frontal).", "Classe de dispar 10, 20 o 30 segons el temps d'arrencada.", "Contactes auxiliars 95-96 (NC) i 97-98 (NA); rearmament manual o automàtic."],
    how: "Les bilàmines s'escalfen amb el corrent del motor. Si el corrent és massa alt durant prou temps, s'acciona el mecanisme: obre el 95-96, que talla la bobina del contactor, i tanca el 97-98 per senyalitzar-ho.",
    sim: "Dispara si el motor treballa amb dues fases (uns 3 s) o si el freneu fent-hi clic (uns 5 s). Després es refreda. Feu-hi clic per rearmar-lo o activeu-ne el rearmament automàtic." };
  I.Breaker = { what: "Disjuntor (guardamotor): interruptor automàtic que protegeix el motor contra curtcircuits i sobrecàrregues i alhora serveix d'interruptor.",
    specs: ["Regulació tèrmica ajustable al corrent del motor.", "Dispar magnètic per a curtcircuits (I>).", "Comandament manual i, sovint, contactes auxiliars."],
    how: "Integra la protecció tèrmica i la magnètica en un sol aparell; es connecta i desconnecta a mà.",
    sim: "Feu-hi clic per obrir-lo o tancar-lo; dispara en un curtcircuit." };
  I.Surge = { what: "Limitador de sobretensions transitòries: protegeix la instal·lació de llamps i maniobres a la xarxa.",
    specs: ["Es connecta entre els conductors actius i terra.", "Tipus 1, 2 o 3 segons la ubicació."],
    how: "En condicions normals no condueix; davant d'una sobretensió molt curta deriva l'energia cap a terra.",
    sim: "Es representa com a càrrega; no intervé en la simulació." };
  I.PermOvervolt = { what: "Protecció contra sobretensions permanents: desconnecta la instal·lació si la tensió es manté massa alta (per exemple, en trencar-se el neutre).",
    specs: ["Actua sobre un interruptor automàtic o diferencial associat."],
    how: "Vigila la tensió de manera contínua i obre quan supera el límit durant un temps.", sim: "Es maneja com un interruptor (clic per obrir o tancar)." };

  // ---------------------------------------------------------------- switching
  I.Contactor = { what: "Contactor (contactes principals o de potència): interruptor de comandament a distància que obre i tanca el circuit de potència quan s'excita la seva bobina.",
    specs: ["Categoria d'ús AC-3 per a motors d'inducció; corrent o potència nominal a la placa.", "Tensió de bobina (24 V, 230 V...).", "Els contactes principals es numeren 1-2, 3-4, 5-6."],
    how: "Quan la bobina A1-A2 rep tensió, l'electroimant atrau l'armadura i tanca tots els contactes alhora; en treure-li tensió, una molla els torna a obrir.",
    sim: "Es tanca quan s'excita la bobina amb el mateix nom (-KM1...). Sota la bobina es veuen les referències creuades dels seus contactes." };
  I.Switch = { what: "Interruptor de potència manual: obre i tanca el circuit amb un comandament a mà.",
    specs: ["Pot tallar en càrrega; corrent nominal en A."], how: "Un mecanisme de molla obre i tanca tots els pols alhora.",
    sim: "Feu-hi clic per obrir-lo o tancar-lo." };
  I.Interlock = { what: "Enclavament mecànic entre dos contactors: impedeix que tots dos es tanquin alhora.",
    specs: ["Es col·loca entre els dos contactors (inversió de gir, estrella-triangle).", "Es complementa amb l'enclavament elèctric (contactes NC creuats)."],
    how: "Una peça mecànica bloqueja l'armadura d'un contactor mentre l'altre és tancat.",
    sim: "Uneix els dos contactors més propers, un a cada costat del símbol: si un és tancat, la bobina de l'altre no pot actuar." };

  // ---------------------------------------------------------------- motors
  I.Motor3 = { what: "Motor asíncron trifàsic de gàbia d'esquirol: el motor més habitual a la indústria.",
    specs: ["Borns U, V, W i PE; placa de característiques amb potència, tensió (230/400 V), corrent i velocitat.", "Arrencada directa: corrent d'arrencada de 5 a 7 vegades el nominal.", "Es connecta en estrella o en triangle segons la tensió de la xarxa."],
    how: "Les tres fases creen un camp magnètic giratori que arrossega el rotor. En intercanviar dues fases, el camp i el motor giren al revés.",
    sim: "Gira en un sentit o l'altre segons la seqüència de fases. Amb només dues fases no arrenca, brunzeix i fa disparar el tèrmic. Feu-hi clic en marxa per frenar-lo (sobrecàrrega)." };
  I.Motor3YD = { what: "Motor trifàsic amb els sis borns del bobinatge accessibles (U1 V1 W1 / U2 V2 W2), per a l'arrencada estrella-triangle.",
    specs: ["En estrella, cada bobina rep 230 V i el corrent d'arrencada es divideix per 3.", "En triangle, cada bobina rep 400 V (funcionament normal)."],
    how: "S'arrenca en estrella per reduir el corrent i, passat un temps, es passa a triangle per obtenir tot el parell.",
    sim: "Detecta si està connectat en estrella (Y, gira més lent) o en triangle (Δ). Una connexió errònia provoca curtcircuit o fa que no giri." };
  I.Motor1 = { what: "Motor monofàsic: motor petit que funciona amb fase i neutre.", specs: ["Borns U i N; sovint porta un condensador o un bobinatge auxiliar per arrencar."],
    how: "Un camp alternatiu sol no fa girar el motor; un mecanisme d'arrencada crea el desfasament necessari.", sim: "Gira quan rep fase i neutre." };
  I.Motor1Cap = { what: "Motor monofàsic amb condensador: el bobinatge auxiliar (Z1-Z2) en sèrie amb un condensador crea el camp giratori d'arrencada.",
    specs: ["Bobinatge principal U1-U2 i auxiliar Z1-Z2.", "El condensador pot ser permanent o només d'arrencada."],
    how: "El condensador desfasa el corrent de l'auxiliar respecte del principal i fa girar el camp. Si s'inverteix l'auxiliar (Z1 per Z2), canvia el sentit de gir.",
    sim: "Gira si reben tensió els dos bobinatges; en intercanviar Z1 i Z2 canvia el sentit. Sense l'auxiliar no arrenca i brunzeix." };
  I.Motor3Dahl = { what: "Motor Dahlander: motor trifàsic de dues velocitats amb un sol bobinatge (relació 1:2).",
    specs: ["Velocitat baixa: alimentació per 1U-1V-1W en triangle.", "Velocitat alta: alimentació per 2U-2V-2W amb 1U-1V-1W units (doble estrella YY)."],
    how: "En canviar la connexió del bobinatge, el nombre de pols es divideix per dos i la velocitat es duplica.",
    sim: "Velocitat baixa o alta segons com s'alimenti. Si s'alimenta 2U-2V-2W sense unir 1U-1V-1W, no arrenca." };
  I.Motor3WR = { what: "Motor de rotor bobinat (anells): el rotor té un bobinatge accessible pels borns K-L-M.",
    specs: ["L'arrencada es fa amb resistències al rotor que s'eliminen per graons.", "Parell d'arrencada alt amb corrent reduït."],
    how: "Les resistències en sèrie amb el rotor limiten el corrent i augmenten el parell en arrencar. Es curtcircuiten graó a graó amb contactors fins deixar el rotor en curtcircuit.",
    sim: "Necessita el rotor tancat (directament o a través de les resistències). Cada graó de resistències no curtcircuitat redueix la velocitat; amb el rotor obert no arrenca." };
  I.MotorDC = { what: "Motor de corrent continu (d'imants permanents): la velocitat depèn de la tensió i el sentit de gir, de la polaritat.",
    specs: ["Borns de l'induït A1-A2.", "Molt fàcil de regular en velocitat."],
    how: "El corrent de l'induït dins del camp dels imants crea un parell. Si s'inverteix la polaritat, gira al revés.",
    sim: "Gira amb «+» a A1 i «−» a A2; amb la polaritat invertida gira al revés. En alterna no gira." };

  // ---------------------------------------------------------------- power electronics
  I.Resistor = { what: "Resistència de potència: limita el corrent.", specs: ["Valor en Ω i potència en W.", "S'usa en arrencades estatòriques o rotòriques i en frenada."],
    how: "Dissipa energia en forma de calor i redueix el corrent del circuit.", sim: "Condueix com un conductor; al rotor d'un motor de rotor bobinat compta com un graó d'arrencada." };
  I.AutoTrans3 = { what: "Autotransformador d'arrencada: redueix la tensió del motor durant l'arrencada.", specs: ["Preses al 50, 65 o 80 % de la tensió."],
    how: "Alimenta el motor a una tensió reduïda i, després, el connecta a la tensió plena.", sim: "Es comporta com un conductor tancat." };
  I.SoftStarter3 = { what: "Arrencador electrònic (arrencador suau): fa pujar la tensió del motor de manera progressiva.",
    specs: ["Rampa d'acceleració i de desacceleració ajustables.", "Redueix el corrent i els cops mecànics de l'arrencada."],
    how: "Els tiristors controlen l'angle de conducció i augmenten la tensió eficaç de 0 al 100 % durant la rampa.",
    sim: "Es tanca quan s'activa el seu control amb el mateix nom. El motor accelera seguint el «Temps de rampa» de les propietats." };
  I.SoftCtrl = { what: "Entrada de control de l'arrencador electrònic: ordre de marxa.", specs: ["Normalment a 24 V CC o 230 V CA."],
    how: "Amb tensió a l'entrada, l'arrencador comença la rampa.", sim: "Es comporta com una bobina: activa l'arrencador del mateix nom." };
  I.Vfd = { what: "Variador de freqüència: regula la velocitat d'un motor d'inducció canviant la freqüència i la tensió.",
    specs: ["Entrada monofàsica o trifàsica i sortida trifàsica U-V-W.", "Rampes, freqüència mínima i màxima i protecció del motor programables."],
    how: "Rectifica la xarxa i, amb un inversor de transistors (IGBT), crea una tensió alterna de freqüència variable.",
    sim: "Deixa passar la potència quan el seu control és actiu, amb rampa d'acceleració segons el «Temps de rampa»." };
  I.VfdCtrl = { what: "Control del variador: entrades de marxa i consigna.", specs: ["Entrades digitals de marxa i sentit i entrada analògica de velocitat."],
    how: "Dona l'ordre de marxa al variador.", sim: "Es comporta com una bobina que activa el variador del mateix nom." };
  I.DriveDC = { what: "Variador de corrent continu: regula la velocitat d'un motor de CC controlant la tensió de l'induït.",
    specs: ["Entrada alterna i sortida contínua (+ −); les versions «shunt» tenen sortida d'excitació E+ E−."],
    how: "Un pont de tiristors rectifica de manera controlada i fixa la tensió de l'induït.", sim: "Deixa passar la potència quan el seu control és actiu, amb rampa de velocitat." };
  I.Stepper = { what: "Controlador de motor pas a pas: genera la seqüència d'impulsos per moure el motor un angle exacte.",
    specs: ["Entrades de rellotge (CLK), sentit (DIR) o fases independents."], how: "Cada impuls avança el motor un pas.",
    sim: "Es representa com a càrrega; no mou cap motor a la simulació." };

  // ---------------------------------------------------------------- contacts and controls
  I.Aux = { what: "Contacte auxiliar d'un contactor o relé: s'utilitza al circuit de maniobra (realimentació, enclavaments, senyalització).",
    specs: ["Corrent petit (categoria AC-15 / DC-13).", "Porta el mateix nom que la bobina que l'acciona."],
    how: "Canvia d'estat quan s'excita la bobina del mateix nom.",
    sim: "Segueix la bobina del mateix nom." };
  I.TimedOn = { what: "Contacte temporitzat a la connexió (TON): canvia d'estat un temps després que s'exciti el temporitzador.",
    specs: ["Borns habituals 67-68 (NA) i 55-56 (NC).", "El temps s'ajusta al temporitzador."],
    how: "Quan la bobina del temporitzador rep tensió, comença a comptar; en acabar, el contacte canvia. En treure-li tensió torna a repòs a l'instant.",
    sim: "Segueix el temporitzador amb el mateix nom (per exemple -KT1)." };
  I.TimedOff = { what: "Contacte temporitzat a la desconnexió (TOF): canvia a l'instant i torna a repòs un temps després de treure la tensió.",
    specs: ["Útil per a ventiladors de postrefrigeració, llums d'escala..."],
    how: "En excitar el temporitzador canvia de seguida; en desexcitar-lo, espera el temps abans de tornar.", sim: "Segueix el temporitzador amb el mateix nom." };
  I.TimedOnOff = { what: "Contacte temporitzat a la connexió i a la desconnexió.", specs: ["Retard tant en activar-se com en desactivar-se."],
    how: "Espera el temps per canviar i també el torna a esperar per tornar a repòs.", sim: "Segueix el temporitzador amb el mateix nom." };
  I.Push = { what: "Polsador: comandament manual que només actua mentre es manté premut.",
    specs: ["Colors normalitzats: verd o blanc per a la marxa; vermell per a l'aturada.", "L'aturada sol ser NC i la marxa NA."],
    how: "En prémer-lo, els contactes canvien; en deixar-lo anar, una molla el torna a repòs.",
    sim: "Feu-hi clic i mantingueu el botó premut. Tots els polsadors amb el mateix nom es mouen alhora." };
  I.Mushroom = { what: "Polsador de bolet (aturada d'emergència): cap gran i vermell sobre fons groc per aturar la màquina en cas de perill.",
    specs: ["Contactes NC d'obertura positiva.", "En els reals queden enclavats i es desbloquegen girant-los."],
    how: "En prémer-lo obre el circuit de maniobra i atura la màquina.", sim: "Actua mentre el manteniu premut." };
  I.SwitchCtl = { what: "Interruptor de maniobra (manual amb retenció): queda en la posició on es deixa.", specs: ["Selector de clau, de maneta o basculant."],
    how: "Cada accionament canvia la posició i s'hi queda.", sim: "Cada clic canvia la posició." };
  I.Sel102 = { what: "Commutador de tres posicions I-0-II.", specs: ["Molt usat per triar entre manual i automàtic o entre dos sentits de gir."],
    how: "Connecta el born comú amb la sortida I, amb cap (0) o amb la sortida II.", sim: "Cada clic passa a la posició següent." };
  I.Sel123 = { what: "Commutador de tres posicions I-II-III.", specs: ["Tria una de tres sortides."], how: "El comú connecta amb una sola sortida segons la posició.",
    sim: "Cada clic passa a la posició següent." };
  I.CrossSw = { what: "Commutador de creuament: permet encendre i apagar un llum des de tres o més punts, intercalat entre dos commutadors.",
    specs: ["Quatre borns."], how: "En cada posició connecta les entrades amb les sortides de manera directa o creuada.", sim: "Cada clic canvia entre directe i creuat." };
  I.Limit = { what: "Final de cursa: detector mecànic que actua quan una peça de la màquina hi arriba i el prem.",
    specs: ["Palanca, roldana o pistó.", "Contactes d'obertura positiva en aplicacions de seguretat."],
    how: "La peça mòbil empeny l'actuador i els contactes canvien d'estat.", sim: "Feu-hi clic i mantingueu-lo premut per simular que la peça hi arriba." };
  I.ThermalContact = { what: "Contacte auxiliar del relé tèrmic: 95-96 (NC) talla la maniobra i 97-98 (NA) senyalitza el dispar.",
    specs: ["Porta el mateix nom que el relé tèrmic (-F1...)."], how: "Canvia d'estat quan el relé tèrmic dispara.", sim: "Segueix el relé tèrmic amb el mateix nom." };
  I.DetInd = { what: "Detector inductiu: detecta objectes metàl·lics sense contacte.", specs: ["Abast de pocs mil·límetres segons el diàmetre.", "Sortida PNP o NPN a 24 V CC, o de dos fils."],
    how: "Un oscil·lador crea un camp magnètic; un metall a prop l'amorteix i el detector canvia la sortida.", sim: "Feu-hi clic i mantingueu-lo premut per simular la presència d'un objecte." };
  I.DetCap = { what: "Detector capacitiu: detecta qualsevol material (plàstic, fusta, líquids...) sense contacte.", specs: ["Abast ajustable amb un potenciòmetre."],
    how: "L'objecte modifica la capacitat del sensor i fa canviar la sortida.", sim: "Feu-hi clic i mantingueu-lo premut per simular la presència." };
  I.DetMag = { what: "Detector magnètic (contacte reed): detecta un imant, per exemple el de l'èmbol d'un cilindre pneumàtic.", specs: ["Molt usat en cilindres per saber-ne la posició."],
    how: "El camp de l'imant tanca les làmines del contacte.", sim: "Feu-hi clic i mantingueu-lo premut per simular l'imant." };
  I.Photo = { what: "Barrera fotoelèctrica: emissor i receptor de llum; detecta un objecte quan talla el feix.", specs: ["Sistemes de barrera, reflex o de detecció directa."],
    how: "El receptor veu la llum de l'emissor; quan un objecte la talla, canvia la sortida.", sim: "Feu-hi clic i mantingueu-lo premut per simular que es talla el feix." };
  I.PhotoEmit = { what: "Emissor de la barrera fotoelèctrica.", specs: ["Necessita alimentació."], how: "Emet el feix de llum (normalment infraroja).", sim: "Es representa com a càrrega." };
  I.Press = { what: "Pressòstat: actua quan la pressió d'un fluid arriba al valor ajustat.", specs: ["Usat en compressors i grups de pressió; té histèresi."],
    how: "Una membrana empeny el mecanisme dels contactes quan la pressió supera la consigna.", sim: "Feu-hi clic i mantingueu-lo premut per simular la pressió." };
  I.Vac = { what: "Vacuòstat: actua en arribar a un cert nivell de buit.", specs: ["Usat en ventoses i bombes de buit."], how: "Com el pressòstat, però amb pressió negativa.",
    sim: "Feu-hi clic i mantingueu-lo premut." };
  I.Thermo = { what: "Termòstat: actua quan la temperatura arriba al valor ajustat.", specs: ["Usat en calefacció i refrigeració; té histèresi."],
    how: "Un element sensible a la temperatura (bilàmina o bulb) mou els contactes.", sim: "Feu-hi clic i mantingueu-lo premut." };

  // ---------------------------------------------------------------- coils and signalling
  I.Coil = { what: "Bobina d'un contactor o relé (A1-A2): l'electroimant que mou tots els seus contactes.",
    specs: ["Tensió de bobina indicada a l'aparell (24 V CA/CC, 230 V CA...).", "Els contactes porten el mateix nom (-KM1, -KA1...)."],
    how: "Amb tensió entre A1 i A2 l'electroimant atrau l'armadura i canvien tots els contactes del mateix nom.",
    sim: "S'il·lumina quan és excitada. Sota seu es mostren les referències creuades dels seus contactes." };
  I.LatchCoil = { what: "Relé biestable (de remanència): manté la posició sense tensió; una bobina l'activa i una altra el desactiva.",
    specs: ["Dues bobines: marxa (set) i aturada (reset)."], how: "Un impuls a la bobina de marxa el deixa activat i un impuls a la de reset el desactiva.",
    sim: "Un impuls a la marxa l'activa i un impuls al reset el desactiva." };
  I.StepRelay = { what: "Telerruptor: relé que canvia d'estat a cada impuls a la bobina.", specs: ["Molt usat per encendre llums des de diversos polsadors."],
    how: "Cada impuls fa avançar un mecanisme que alterna el contacte entre obert i tancat.", sim: "Cada impuls a la bobina canvia l'estat dels seus contactes." };
  I.Solenoid = { what: "Bobina d'electrovàlvula: obre o tanca el pas d'un fluid (aire, aigua...) o mou un distribuïdor pneumàtic.", specs: ["Tensió de bobina 24 V CC o 230 V CA."],
    how: "L'electroimant desplaça el nucli de la vàlvula.", sim: "S'activa mentre té tensió." };
  I.Timer = { what: "Temporitzador: relé que activa els seus contactes un temps després (o durant un temps) segons el tipus.",
    specs: ["Temps ajustable; els contactes temporitzats tenen el mateix nom (-KT1).", "Electrònics, multifunció o pneumàtics."],
    how: "Una base de temps electrònica compta a partir de l'excitació (connexió) o de la desexcitació (desconnexió).",
    sim: "Mostra el temps que queda. El temps es configura a les propietats (valor × multiplicador)." };
  I.Flasher = { what: "Relé intermitent: activa i desactiva el contacte de manera periòdica mentre té tensió.", specs: ["Temps d'activació i de repòs."],
    how: "Una base de temps commuta la sortida contínuament.", sim: "Alterna amb el període ajustat a les propietats." };
  I.PulseGen = { what: "Generador de polsos: dona polsos periòdics mentre té tensió.", specs: ["Període ajustable."], how: "Commuta la sortida a intervals regulars.",
    sim: "Alterna amb el període ajustat." };
  I.TimeSwitch = { what: "Interruptor horari: connecta i desconnecta un circuit segons un programa de temps.", specs: ["Analògic (rodeta de segments) o digital (programes setmanals)."],
    how: "Un rellotge intern activa el contacte a les hores programades.", sim: "Repeteix un cicle ON/OFF; els temps s'ajusten a les propietats." };
  I.Counter = { what: "Comptador de polsos: compta impulsos i actua en arribar a la preselecció.", specs: ["Entrada de comptatge A1-A2 i de posada a zero R."],
    how: "Cada impuls a l'entrada suma 1; en arribar al valor preseleccionat, els contactes canvien. Amb tensió a R torna a zero.",
    sim: "Mostra el compte i la preselecció (ajustable a les propietats)." };
  I.Lamp = { what: "Pilot de senyalització: indica un estat de la màquina amb llum.",
    specs: ["Colors normalitzats (EN 60204-1): vermell = emergència o avaria; groc = anomalia o avís; verd = funcionament normal o marxa; blau = acció obligatòria; blanc = informació.", "Borns X1-X2."],
    how: "S'encén quan rep tensió.", sim: "S'encén amb el color triat a les propietats." };
  I.LampFlash = { what: "Pilot intermitent: senyalització que parpelleja per cridar l'atenció.", specs: ["Usat per a alarmes i avisos."], how: "Una electrònica interna fa intermitència.",
    sim: "Parpelleja mentre té tensió." };
  I.Acoustic = { what: "Senyalització acústica: avisa amb so d'un estat o d'una alarma.", specs: ["Timbre, brunzidor, sirena o botzina segons el volum i el to."],
    how: "Sona mentre rep tensió.", sim: "Sona mentre té tensió (es pot silenciar a Mode › So dels avisadors)." };

  // ---------------------------------------------------------------- electronic relays
  I.Ssr = { what: "Relé d'estat sòlid (SSR): commuta una càrrega sense parts mòbils, amb semiconductors.",
    specs: ["Control en CC (3-32 V) i sortida en CA o CC.", "Commutació silenciosa i ràpida, sense desgast; s'escalfa i sovint necessita dissipador."],
    how: "El senyal de control activa, a través d'un optoacoblador, el tiristor o transistor de sortida.", sim: "La sortida condueix mentre l'entrada de control té tensió." };
  I.SsrCont = { what: "Contactor d'estat sòlid: versió trifàsica de potència del relé d'estat sòlid.", specs: ["Ideal per a maniobres molt freqüents (resistències de forns)."],
    how: "Commuta les fases amb tiristors.", sim: "Es tanca quan el seu control del mateix nom és actiu." };
  I.PhaseLoss = { what: "Relé de control de fases (falta de fase): vigila que hi hagi les tres fases.", specs: ["Algunes versions també vigilen el neutre."],
    how: "Si falta una fase, desactiva el contacte de sortida.", sim: "S'activa quan rep les tres fases (i el neutre, si en vigila)." };
  I.PhaseSeq = { what: "Relé de seqüència de fases: comprova que l'ordre de les fases sigui el correcte (L1-L2-L3).",
    specs: ["Evita que un motor giri al revés després d'una intervenció a la xarxa."], how: "Detecta la seqüència i només activa la sortida si és la correcta.",
    sim: "S'activa només amb la seqüència L1-L2-L3." };
  I.CoilContact = { what: "Relé amb bobina i contacte en un sol símbol.", specs: ["Relé d'interfície petit."], how: "La bobina mou el contacte integrat.",
    sim: "El contacte canvia quan s'excita la bobina." };

  // ---------------------------------------------------------------- logic
  var LOGIC_INTRO = "Element de lògica digital: un «1» és un conductor amb «+» i un «0», sense tensió.";
  I.LogicAnd = { what: "Porta AND (I): la sortida és 1 només si totes les entrades són 1.", specs: ["Taula: 00→0, 01→0, 10→0, 11→1.", "Símbol IEC «&»."],
    how: "Equival a contactes NA en sèrie.", sim: LOGIC_INTRO };
  I.LogicOr = { what: "Porta OR (O): la sortida és 1 si alguna entrada és 1.", specs: ["Taula: 00→0, 01→1, 10→1, 11→1.", "Símbol IEC «≥1»."], how: "Equival a contactes NA en paral·lel.", sim: LOGIC_INTRO };
  I.LogicNot = { what: "Porta NOT (inversor): la sortida és la contrària de l'entrada.", specs: ["Taula: 0→1, 1→0.", "El cercle a la sortida indica la negació."], how: "Equival a un contacte NC.", sim: LOGIC_INTRO };
  I.LogicXor = { what: "Porta XOR (O exclusiva): la sortida és 1 quan les entrades són diferents.", specs: ["Taula: 00→0, 01→1, 10→1, 11→0.", "Símbol IEC «=1»."],
    how: "Com un circuit de commutadors d'escala.", sim: LOGIC_INTRO };
  I.LogicNand = { what: "Porta NAND: AND negada; la sortida és 0 només si totes les entrades són 1.", specs: ["Taula: 00→1, 01→1, 10→1, 11→0.", "Porta universal: amb NAND es pot fer qualsevol funció."],
    how: "Equival a contactes NC en paral·lel.", sim: LOGIC_INTRO };
  I.LogicNor = { what: "Porta NOR: OR negada; la sortida és 1 només si totes les entrades són 0.", specs: ["Taula: 00→1, 01→0, 10→0, 11→0.", "També és una porta universal."],
    how: "Equival a contactes NC en sèrie.", sim: LOGIC_INTRO };
  I.LogicSR = { what: "Biestable SR: memòria d'un bit amb entrades de posada a 1 (S) i a 0 (R).", specs: ["Sortides Q i Q̄ (negada).", "Aquí, amb S i R alhora mana el reset (R prioritari)."],
    how: "Un impuls a S posa Q a 1 i s'hi queda; un impuls a R el torna a 0. És l'equivalent lògic de la realimentació d'un contactor.", sim: LOGIC_INTRO };
  I.LogicDiv2 = { what: "Divisor binari (biestable T): canvia la sortida a cada flanc de pujada de l'entrada.", specs: ["Divideix la freqüència per 2.", "Entrada R de posada a zero."],
    how: "Cada impuls a C inverteix Q: amb un sol polsador es fa marxa i aturada (com un telerruptor).", sim: LOGIC_INTRO };
  I.LogicTon = { what: "Temporitzador a la connexió (TON): la sortida s'activa un temps després que l'entrada passi a 1.", specs: ["Si l'entrada torna a 0 abans d'acabar el temps, no s'activa."],
    how: "Compta mentre l'entrada és 1; en acabar el temps, la sortida passa a 1.", sim: LOGIC_INTRO + " El temps es configura a les propietats." };
  I.LogicTp = { what: "Temporitzador d'impuls (TP): en el flanc de pujada de l'entrada dona un impuls de durada fixa.", specs: ["La durada no depèn de quant duri l'entrada."],
    how: "Cada flanc de pujada engega un impuls de durada T.", sim: LOGIC_INTRO };
  I.LogicTof = { what: "Temporitzador a la desconnexió (TOF): la sortida segueix l'entrada i, quan aquesta passa a 0, encara es manté durant un temps.",
    specs: ["Usat en llums d'escala o ventiladors de postrefrigeració."], how: "Quan l'entrada baixa, compta el temps abans de desactivar la sortida.", sim: LOGIC_INTRO };
  I.LogicFlash = { what: "Temporitzador intermitent: mentre l'entrada és 1, la sortida alterna entre 1 i 0.", specs: ["El temps fixa cada semiperíode."],
    how: "Commuta la sortida cada vegada que passa el temps.", sim: LOGIC_INTRO };
  I.LogicPulse = { what: "Generador de polsos: mentre l'entrada és 1, dona un impuls curt cada cert temps.", specs: ["Útil com a rellotge per a comptadors."],
    how: "Cada vegada que passa el temps, la sortida dona un impuls breu.", sim: LOGIC_INTRO + " Els impulsos duren 0,2 s." };
  I.LogicCnt = { what: "Comptador ascendent (CTU): compta els flancs de pujada de l'entrada C.", specs: ["Q s'activa en arribar a la preselecció.", "R posa el compte a zero."],
    how: "Cada impuls suma 1.", sim: LOGIC_INTRO + " La preselecció es configura a les propietats." };
  I.LogicCntUD = { what: "Comptador ascendent-descendent (CTUD): suma amb «+» i resta amb «−».", specs: ["Q s'activa quan el compte arriba a la preselecció.", "R posa a zero."],
    how: "Útil per comptar peces que entren i surten d'una zona.", sim: LOGIC_INTRO };
  I.LogicCnt4 = { what: "Comptador binari de 4 bits: compta de 0 a 15 i dona el valor en binari (1-2-4-8).", specs: ["Després del 15 torna a 0.", "R posa a zero."],
    how: "Cada flanc de pujada suma 1.", sim: LOGIC_INTRO };
  I.LogicCnt4UD = { what: "Comptador binari de 4 bits ascendent-descendent.", specs: ["De 0 a 15 i sortides 1-2-4-8.", "Per sota de 0 passa a 15."], how: "Suma amb «+» i resta amb «−».", sim: LOGIC_INTRO };
  I.LogicCnt10 = { what: "Comptador de dècades (BCD): compta de 0 a 9 en codi BCD.", specs: ["Després del 9 torna a 0.", "Encadenant-ne diversos es fan unitats, desenes..."],
    how: "Ideal per mostrar el compte en un display de 7 segments a través d'un decodificador.", sim: LOGIC_INTRO };
  I.LogicProbe = { what: "Prova (entrada lògica manual): posa un 0 o un 1 en un conductor.", specs: ["Serveix per provar circuits lògics."], how: "Cada clic alterna entre 0 i 1.", sim: LOGIC_INTRO };
  I.LogicView = { what: "Visualitza: indicador de l'estat lògic d'un conductor.", specs: ["Mostra 0 o 1."], how: "Es posa vermell quan l'entrada és 1.", sim: LOGIC_INTRO };
  I.Logic7Dec = { what: "Decodificador BCD a 7 segments: converteix un número binari de 4 bits en els segments a–g que l'han de dibuixar.",
    specs: ["Entrades 1-2-4-8 i sortides a, b, c, d, e, f, g.", "Aquí també mostra A–F per als valors 10–15."],
    how: "Per a cada valor activa els segments necessaris (per exemple, el 7 activa a, b i c).", sim: LOGIC_INTRO };
  I.Logic7Seg = { what: "Display de 7 segments: mostra un dígit encenent els segments a–g.", specs: ["Segments: a dalt (a), dreta (b, c), baix (d), esquerra (e, f) i centre (g).", "Ànode o càtode comú en els reals."],
    how: "Cada entrada a 1 encén el seu segment.", sim: LOGIC_INTRO };
  I.Logic7SegDp = { what: "Display de 7 segments amb punt decimal (dp).", specs: ["Una entrada més per al punt."], how: "Com el display de 7 segments.", sim: LOGIC_INTRO };
  I.LogicPreset = { what: "Preselector (roda de dígits): permet triar un número de 0 a 9 i el dona en BCD (1-2-4-8).", specs: ["S'usa per introduir consignes en circuits lògics."],
    how: "Cada clic augmenta el dígit; el valor es desa amb l'esquema.", sim: LOGIC_INTRO };

  // ---------------------------------------------------------------- connections
  I.Terminal = { what: "Born de connexió (regleta): punt de connexió entre el quadre i els elements exteriors.",
    specs: ["Es numeren i s'agrupen en regletes (-X1, -X2...).", "Facilita el cablejat i el manteniment."], how: "Uneix dos conductors.", sim: "Es comporta com un conductor." };
  I.Continuation = { what: "Referència de continuació: indica que un conductor continua en un altre punt o full de l'esquema.",
    specs: ["Totes les referències amb el mateix nom estan unides.", "Al costat es mostra on són les altres (full.columna)."],
    how: "Evita dibuixar conductors llargs que travessen l'esquema.", sim: "Uneix elèctricament totes les referències amb el mateix nom." };

  // ---------------------------------------------------------------- lookup
  var FAMILY = [
    [/^Feed/, "Feed"], [/^Fuse\d/, "Fuse"], [/^FuseSw/, "FuseSw"], [/^Auto/, "Auto"], [/^Rcd/, "Rcd"], [/^Breaker/, "Breaker"],
    [/^Surge/, "Surge"], [/^PermOvervolt/, "PermOvervolt"], [/^Contactor/, "Contactor"], [/^Switch\d/, "Switch"],
    [/^Resistor/, "Resistor"], [/^SoftRevCtrl/, "SoftCtrl"], [/^Vfd.*Ctrl/, "VfdCtrl"], [/^Vfd/, "Vfd"], [/^DriveDCCtrl/, "VfdCtrl"], [/^DriveDC/, "DriveDC"],
    [/^Stepper/, "Stepper"], [/^Aux/, "Aux"], [/^TimedOnOff/, "TimedOnOff"], [/^TimedOn/, "TimedOn"], [/^TimedOff/, "TimedOff"],
    [/^Push/, "Push"], [/^Mushroom/, "Mushroom"], [/^Switch(NO|NC|NONC|CO)$/, "SwitchCtl"], [/^Limit/, "Limit"], [/^Thermal(NO|NC|NONC|CO)$/, "ThermalContact"],
    [/^DetInd/, "DetInd"], [/^DetCap/, "DetCap"], [/^DetMag/, "DetMag"], [/^PhotoRec|^PhotoBarrier/, "Photo"], [/^Press/, "Press"], [/^Vac/, "Vac"], [/^Thermo/, "Thermo"],
    [/^Timer/, "Timer"], [/^(Bell|Buzzer|Siren|Horn)$/, "Acoustic"], [/^Ssr(DC|AC)$/, "Ssr"], [/^SsrCont/, "SsrCont"],
    [/^PhaseLoss/, "PhaseLoss"], [/^PhaseSeq/, "PhaseSeq"], [/^CoilContact/, "CoilContact"],
  ];

  /** Teaching notes for an element kind: { what, specs[], how, sim }. */
  SL.kindInfo = function (kind) {
    var base = I[kind], i;
    for (i = 0; !base && i < FAMILY.length; i++) if (FAMILY[i][0].test(kind)) base = I[FAMILY[i][1]];
    if (!base) return null;
    var specs = (base.specs || []).slice(), K = SL.KINDS[kind];
    var ct = (K && ["Contact", "Actuator"].indexOf(K.role) >= 0) || /^(Aux|Timed|Thermal(NO|NC|NONC|CO)$)/.test(kind) ? contactType(kind) : null;
    if (ct) specs.unshift(ct);
    var pt = /^(Fuse|FuseSw|Auto|Breaker|Switch\d|Contactor\d|Rcd|Resistor)/.test(kind) ? polesText(kind) : null;
    if (pt) specs.unshift(pt);
    return { what: base.what, specs: specs, how: base.how, sim: base.sim };
  };
})((typeof globalThis !== "undefined" ? globalThis : window).SL);
