// engine/moves.js
// Animazioni SVG dei movimenti + schede esercizio (muscoli, esecuzione, errori).
// Figura stilizzata in vista laterale, cinematica diretta da angoli articolari.
// Ogni animazione = sequenza di pose (angoli in gradi, 0 = verso l'alto, positivo = orario)
// interpolate con SMIL <animate attributeName="points">. Nessuna dipendenza, funziona offline.

const L = { shin: 34, thigh: 36, torso: 40, head: 11, upper: 26, fore: 24 }; // lunghezze segmenti (px)
const dir = a => { const r = a * Math.PI / 180; return [Math.sin(r), -Math.cos(r)]; };

/**
 * Pose: { shin, thigh, torso, upper, fore, ankle:[x,y], neck? }
 * Cinematica dalla caviglia (fissa) verso l'alto; braccio dalla spalla.
 */
function fk(p) {
  const [ax, ay] = p.ankle ?? [100, 170];
  const add = ([x, y], a, len) => { const [dx, dy] = dir(a); return [x + dx * len, y + dy * len]; };
  const knee = add([ax, ay], p.shin, L.shin);
  const hip = add(knee, p.thigh, L.thigh);
  const shoulder = add(hip, p.torso, L.torso);
  const headC = add(shoulder, (p.neck ?? p.torso), L.head + 6);
  const elbow = add(shoulder, p.upper, L.upper);
  const wrist = add(elbow, p.fore, L.fore);
  // gamba posteriore (leggermente sfalsata) per dare profondità
  const knee2 = add([ax + (p.ankle2dx ?? 0), ay], p.shin2 ?? p.shin, L.shin);
  const hip2 = add(knee2, p.thigh2 ?? p.thigh, L.thigh);
  return { ankle: [ax, ay], knee, hip, shoulder, headC, elbow, wrist, knee2, hip2, ankle2: [ax + (p.ankle2dx ?? 0), ay] };
}

const r1 = n => Math.round(n * 10) / 10;
const pts = arr => arr.map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');

/** Genera l'SVG animato per una lista di pose (ciclo avanti-indietro). */
export function moveSVG(anim, { size = 200 } = {}) {
  const poses = anim.poses.map(fk);
  const seq = [...poses, ...poses.slice(0, -1).reverse()]; // ping-pong
  const dur = anim.dur ?? 2.4;
  const seg = (key, stroke, w) => {
    const values = seq.map(f => pts(key.map(k => f[k]))).join(';');
    return `<polyline stroke="${stroke}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round" points="${pts(key.map(k => poses[0][k]))}"><animate attributeName="points" values="${values}" dur="${dur}s" repeatCount="indefinite" calcMode="spline" keySplines="${seq.slice(1).map(() => '.42 0 .58 1').join(';')}"/></polyline>`;
  };
  const headVals = k => seq.map(f => r1(f.headC[k])).join(';');
  const propSVG = (anim.props ?? []).map(p => prop(p, poses, seq, dur)).join('');
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${anim.label}">
  <defs><linearGradient id="gm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8ff00"/><stop offset="1" stop-color="#9dff1c"/></linearGradient>
  <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <line x1="20" y1="170.5" x2="180" y2="170.5" stroke="#35383f" stroke-width="1.5" stroke-dasharray="4 5"/>
  ${propSVG}
  <g opacity=".35">${seg(['ankle2', 'knee2', 'hip2'], '#9dff1c', 7)}</g>
  ${seg(['ankle', 'knee', 'hip', 'shoulder'], 'url(#gm)', 8)}
  ${seg(['shoulder', 'elbow', 'wrist'], '#e8ff00', 7)}
  <circle r="${L.head}" fill="url(#gm)" filter="url(#glow)" cx="${r1(poses[0].headC[0])}" cy="${r1(poses[0].headC[1])}"><animate attributeName="cx" values="${headVals(0)}" dur="${dur}s" repeatCount="indefinite"/><animate attributeName="cy" values="${headVals(1)}" dur="${dur}s" repeatCount="indefinite"/></circle>
  ${anim.props?.includes('bar') ? barSVG(poses, seq, dur) : ''}
</svg>`;
}

function barSVG(poses, seq, dur) {
  // Bilanciere/manubrio disegnato al polso
  const v = k => seq.map(f => r1(f.wrist[k])).join(';');
  return `<g><circle r="9" fill="#17181b" stroke="#f4f4f2" stroke-width="3" cx="${r1(poses[0].wrist[0])}" cy="${r1(poses[0].wrist[1])}"><animate attributeName="cx" values="${v(0)}" dur="${dur}s" repeatCount="indefinite"/><animate attributeName="cy" values="${v(1)}" dur="${dur}s" repeatCount="indefinite"/></circle></g>`;
}

function prop(p, poses, seq, dur) {
  switch (p) {
    case 'bench':   return `<rect x="50" y="142" width="100" height="10" rx="3" fill="#35383f"/><rect x="65" y="152" width="6" height="18" fill="#2a2c31"/><rect x="129" y="152" width="6" height="18" fill="#2a2c31"/>`;
    case 'pullbar': return `<line x1="40" y1="28" x2="160" y2="28" stroke="#f4f4f2" stroke-width="4" stroke-linecap="round"/>`;
    case 'lowbar':  return `<line x1="40" y1="86" x2="160" y2="86" stroke="#f4f4f2" stroke-width="4" stroke-linecap="round"/>`;
    case 'benchlow':return `<rect x="55" y="152" width="110" height="9" rx="3" fill="#35383f"/><rect x="70" y="161" width="6" height="9" fill="#2a2c31"/><rect x="144" y="161" width="6" height="9" fill="#2a2c31"/>`;
    case 'seat':    return `<rect x="88" y="128" width="46" height="8" rx="3" fill="#35383f"/><rect x="128" y="80" width="8" height="56" rx="3" fill="#35383f"/>`;
    case 'wall':    return `<line x1="150" y1="20" x2="150" y2="170" stroke="#35383f" stroke-width="4"/>`;
    case 'cable':   return `<line x1="20" y1="20" x2="20" y2="170" stroke="#35383f" stroke-width="4"/>`;
    default: return '';
  }
}

// ---------------------------------------------------------------------------
// Animazioni per pattern/variante. Angoli: 0 = su, 90 = destra (avanti), -90 = sinistra (dietro), 180 = giù.

const A = {
  squat: { label: 'Squat', props: ['bar'], poses: [
    { shin: 0, thigh: 0, torso: 0, upper: 100, fore: -60, ankle: [100, 170], ankle2dx: 6 },
    { shin: 30, thigh: -80, torso: 25, upper: 100, fore: -70, ankle: [100, 170], ankle2dx: 6 },
  ] },
  lunge: { label: 'Affondo', poses: [
    { shin: 0, thigh: 0, torso: 0, upper: 160, fore: 170, ankle: [100, 170], shin2: 0, thigh2: 0, ankle2dx: 0 },
    { shin: 10, thigh: -75, torso: 5, upper: 165, fore: 170, ankle: [110, 170], shin2: -60, thigh2: 5, ankle2dx: -40 },
  ] },
  legext: { label: 'Leg extension', props: ['seat'], poses: [
    { shin: 180, thigh: 90, torso: 0, upper: 150, fore: 200, ankle: [110, 128], ankle2dx: 0 },
    { shin: 95, thigh: 90, torso: 0, upper: 150, fore: 200, ankle: [110, 128], ankle2dx: 0 },
  ] },
  hinge: { label: 'Stacco', props: ['bar'], poses: [
    { shin: 0, thigh: 0, torso: 0, upper: 175, fore: 180, ankle: [100, 170], ankle2dx: 6 },
    { shin: 15, thigh: -40, torso: 70, upper: 165, fore: 175, ankle: [100, 170], ankle2dx: 6 },
  ] },
  rdl: { label: 'Stacco rumeno', props: ['bar'], poses: [
    { shin: 0, thigh: 0, torso: 0, upper: 175, fore: 180, ankle: [100, 170], ankle2dx: 6 },
    { shin: 5, thigh: -15, torso: 80, upper: 165, fore: 175, ankle: [100, 170], ankle2dx: 6 },
  ] },
  bridge: { label: 'Ponte glutei', poses: [
    { shin: 0, thigh: -90, torso: -95, upper: -100, fore: -100, ankle: [120, 170], ankle2dx: 6, neck: -90 },
    { shin: 10, thigh: -60, torso: -60, upper: -100, fore: -100, ankle: [120, 170], ankle2dx: 6, neck: -70 },
  ] },
  legcurl: { label: 'Leg curl', props: ['benchlow'], poses: [
    { shin: -90, thigh: -90, torso: -90, upper: -150, fore: -100, ankle: [180, 148], ankle2dx: 0, neck: -90 },
    { shin: 180, thigh: -90, torso: -90, upper: -150, fore: -100, ankle: [146, 114], ankle2dx: 0, neck: -90 },
  ] },
  nordic: { label: 'Nordic curl', poses: [
    { shin: -90, thigh: 0, torso: 0, upper: 60, fore: 100, ankle: [135, 170], ankle2dx: 0 },
    { shin: -90, thigh: -30, torso: -30, upper: 60, fore: 100, ankle: [135, 170], ankle2dx: 0 },
  ] },
  pushup: { label: 'Piegamenti', poses: [
    { shin: -65, thigh: -65, torso: -65, upper: 175, fore: 180, ankle: [165, 170], ankle2dx: 0, neck: -65 },
    { shin: -80, thigh: -80, torso: -80, upper: 250, fore: 120, ankle: [165, 170], ankle2dx: 0, neck: -80 },
  ], dur: 2 },
  bench: { label: 'Panca', props: ['bench', 'bar'], poses: [
    { shin: -30, thigh: -90, torso: -90, upper: 0, fore: 0, ankle: [165, 170], ankle2dx: 0, neck: -90 },
    { shin: -30, thigh: -90, torso: -90, upper: 80, fore: -30, ankle: [165, 170], ankle2dx: 0, neck: -90 },
  ] },
  dips: { label: 'Dip', poses: [
    { shin: 0, thigh: 20, torso: 5, upper: 180, fore: 180, ankle: [100, 175], ankle2dx: 6 },
    { shin: 0, thigh: 20, torso: 15, upper: 240, fore: 160, ankle: [100, 175], ankle2dx: 6 },
  ] },
  ohp: { label: 'Military press', props: ['bar'], poses: [
    { shin: 0, thigh: 0, torso: 0, upper: 120, fore: -20, ankle: [100, 170], ankle2dx: 6 },
    { shin: 0, thigh: 0, torso: -5, upper: 10, fore: 0, ankle: [100, 170], ankle2dx: 6 },
  ] },
  latraise: { label: 'Alzate laterali', props: ['bar'], poses: [
    { shin: 0, thigh: 0, torso: 0, upper: 180, fore: 180, ankle: [100, 170], ankle2dx: 6 },
    { shin: 0, thigh: 0, torso: 0, upper: 95, fore: 100, ankle: [100, 170], ankle2dx: 6 },
  ] },
  pike: { label: 'Pike push-up', poses: [
    { shin: -20, thigh: -20, torso: 120, upper: 190, fore: 180, ankle: [145, 170], ankle2dx: 0, neck: 150 },
    { shin: -20, thigh: -20, torso: 125, upper: 220, fore: 160, ankle: [145, 170], ankle2dx: 0, neck: 150 },
  ] },
  handstand: { label: 'Verticale', props: ['wall'], poses: [
    { shin: 180, thigh: 180, torso: 180, upper: 180, fore: 180, ankle: [140, -4], ankle2dx: 0, neck: 190 },
    { shin: 180, thigh: 180, torso: 180, upper: 180, fore: 180, ankle: [140, -4], ankle2dx: 0, neck: 190 },
  ], dur: 4 },
  row: { label: 'Rematore', props: ['bar'], poses: [
    { shin: 10, thigh: -20, torso: 75, upper: 165, fore: 175, ankle: [100, 170], ankle2dx: 6 },
    { shin: 10, thigh: -20, torso: 75, upper: -160, fore: 160, ankle: [100, 170], ankle2dx: 6 },
  ] },
  invrow: { label: 'Rematore inverso', props: ['lowbar'], poses: [
    { shin: 0, thigh: -90, torso: -90, upper: 0, fore: 0, ankle: [150, 170], ankle2dx: 0, neck: -90 },
    { shin: 0, thigh: -70, torso: -70, upper: 60, fore: -70, ankle: [150, 170], ankle2dx: 0, neck: -70 },
  ] },
  cablerow: { label: 'Pulley', props: ['cable'], poses: [
    { shin: -50, thigh: 110, torso: 5, upper: -95, fore: -90, ankle: [60, 150], ankle2dx: 0 },
    { shin: -50, thigh: 110, torso: -5, upper: 150, fore: -80, ankle: [60, 150], ankle2dx: 0 },
  ] },
  facepull: { label: 'Face pull', props: ['cable'], poses: [
    { shin: 0, thigh: 0, torso: 0, upper: -85, fore: -90, ankle: [110, 170], ankle2dx: 6 },
    { shin: 0, thigh: 0, torso: 0, upper: -85, fore: 100, ankle: [110, 170], ankle2dx: 6 },
  ] },
  pullup: { label: 'Trazioni', props: ['pullbar'], poses: [
    { shin: 20, thigh: 0, torso: 0, upper: 0, fore: 0, ankle: [100, 150], ankle2dx: 6 },
    { shin: 20, thigh: 0, torso: 5, upper: 110, fore: -40, ankle: [100, 110], ankle2dx: 6 },
  ] },
  pulldown: { label: 'Lat machine', props: ['seat'], poses: [
    { shin: 0, thigh: 90, torso: -5, upper: 0, fore: 10, ankle: [70, 170], ankle2dx: 0 },
    { shin: 0, thigh: 90, torso: -10, upper: 150, fore: -30, ankle: [70, 170], ankle2dx: 0 },
  ] },
  curl: { label: 'Curl', props: ['bar'], poses: [
    { shin: 0, thigh: 0, torso: 0, upper: 175, fore: 180, ankle: [100, 170], ankle2dx: 6 },
    { shin: 0, thigh: 0, torso: 0, upper: 170, fore: 20, ankle: [100, 170], ankle2dx: 6 },
  ] },
  tricep: { label: 'Estensioni tricipiti', props: ['bar'], poses: [
    { shin: 0, thigh: 0, torso: 0, upper: 0, fore: -150, ankle: [100, 170], ankle2dx: 6 },
    { shin: 0, thigh: 0, torso: 0, upper: 0, fore: 5, ankle: [100, 170], ankle2dx: 6 },
  ] },
  plank: { label: 'Plank', poses: [
    { shin: -75, thigh: -75, torso: -75, upper: 180, fore: -90, ankle: [165, 170], ankle2dx: 0, neck: -75 },
    { shin: -75, thigh: -75, torso: -75, upper: 180, fore: -90, ankle: [165, 170], ankle2dx: 0, neck: -75 },
  ], dur: 4 },
  deadbug: { label: 'Dead bug', poses: [
    { shin: -90, thigh: 180, torso: -90, upper: 0, fore: 0, ankle: [134, 131], ankle2dx: 0, neck: -90 },
    { shin: -70, thigh: 160, torso: -90, upper: -80, fore: -90, ankle: [160, 148], ankle2dx: 0, neck: -90 },
  ] },
  hangraise: { label: 'Sollevamento gambe', props: ['pullbar'], poses: [
    { shin: 0, thigh: 0, torso: 0, upper: 0, fore: 0, ankle: [100, 150], ankle2dx: 6 },
    { shin: 0, thigh: 90, torso: 5, upper: 0, fore: 0, ankle: [140, 115], ankle2dx: 6 },
  ] },
};

// esercizio id → animazione
export const EXERCISE_ANIM = {
  back_squat: 'squat', goblet_squat: 'squat', bw_squat: 'squat', leg_press: 'legext', split_squat: 'lunge', leg_ext: 'legext',
  deadlift: 'hinge', rdl: 'rdl', hip_thrust: 'bridge', glute_bridge: 'bridge', leg_curl: 'legcurl', nordic: 'nordic',
  bench: 'bench', db_bench: 'bench', pushup: 'pushup', decline_pushup: 'pushup', diamond_pushup: 'pushup', chair_dips: 'dips', incline_db: 'bench', dips: 'dips', cable_fly: 'latraise',
  ohp: 'ohp', db_ohp: 'ohp', pike_pushup: 'pike', wall_hs_hold: 'handstand', band_lat_raise: 'latraise', lat_raise: 'latraise',
  bb_row: 'row', db_row: 'row', inv_row: 'invrow', towel_row: 'invrow', band_face_pull: 'facepull', cable_row: 'cablerow', face_pull: 'facepull',
  pullup: 'pullup', lat_pulldown: 'pulldown', band_pulldown: 'pulldown', band_curl: 'curl', bicep_curl: 'curl',
  plank: 'plank', deadbug: 'deadbug', hanging_raise: 'hangraise', tricep_ext: 'tricep',
};

export function animFor(exerciseId) { return A[EXERCISE_ANIM[exerciseId] ?? 'squat']; }
export function exerciseSVG(exerciseId, opts) { return moveSVG(animFor(exerciseId), opts); }

// ---------------------------------------------------------------------------
// Schede: muscoli, esecuzione, errori comuni. Per pattern con override per esercizio.

const P = {
  squat: { primary: ['Quadricipiti', 'Glutei'], secondary: ['Femorali', 'Core', 'Adduttori'],
    steps: ['Piedi larghezza spalle, punte leggermente in fuori, peso sul centro del piede.', 'Inspira, irrigidisci l\'addome e scendi piegando anche e ginocchia insieme.', 'Scendi finché le cosce sono almeno parallele al pavimento, ginocchia in linea con le punte.', 'Spingi il pavimento via con tutto il piede e risali espirando.'],
    mistakes: ['Talloni che si alzano', 'Ginocchia che collassano verso l\'interno', 'Schiena che si arrotonda in basso'] },
  hinge: { primary: ['Femorali', 'Glutei'], secondary: ['Lombari', 'Trapezio', 'Avambracci'],
    steps: ['Bilanciere a metà piede, tibie quasi a contatto, presa poco più larga delle gambe.', 'Petto in fuori, schiena neutra, spalle sopra la barra.', 'Spingi con le gambe tenendo la barra a contatto con il corpo, anche e spalle salgono insieme.', 'Blocca in alto contraendo i glutei, poi scendi controllando con le anche indietro.'],
    mistakes: ['Schiena arrotondata', 'Barra lontana dal corpo', 'Iperestensione in chiusura'] },
  h_push: { primary: ['Pettorali', 'Tricipiti'], secondary: ['Deltoidi anteriori', 'Core'],
    steps: ['Scapole addotte e depresse, presa poco più larga delle spalle.', 'Scendi controllando fino a sfiorare il petto, gomiti a ~45° dal busto.', 'Spingi in modo esplosivo fino a braccia distese senza perdere l\'assetto scapolare.'],
    mistakes: ['Gomiti troppo aperti (90°)', 'Rimbalzo sul petto', 'Perdere il contatto delle scapole'] },
  v_push: { primary: ['Deltoidi', 'Tricipiti'], secondary: ['Trapezio', 'Core'],
    steps: ['Piedi stabili, glutei e addome contratti per non inarcare la schiena.', 'Spingi in verticale portando la testa leggermente indietro per far passare il carico.', 'Blocca sopra la testa con le spalle attive, poi scendi controllando fino al mento.'],
    mistakes: ['Inarcare la lombare', 'Spingere in avanti invece che in verticale', 'Mezze ripetizioni'] },
  h_pull: { primary: ['Dorsali', 'Romboidi', 'Trapezio medio'], secondary: ['Bicipiti', 'Deltoidi posteriori', 'Lombari'],
    steps: ['Busto inclinato e stabile, schiena neutra, scapole libere di muoversi.', 'Tira il carico verso l\'ombelico portando i gomiti indietro e le scapole insieme.', 'Pausa di un secondo in chiusura, poi rilascia controllando fino a braccia distese.'],
    mistakes: ['Slancio con il busto', 'Tirare con le braccia invece che con i gomiti', 'Spalle che salgono verso le orecchie'] },
  v_pull: { primary: ['Dorsali', 'Bicipiti'], secondary: ['Romboidi', 'Trapezio inferiore', 'Avambracci'],
    steps: ['Presa salda, scapole depresse prima di iniziare (spalle lontane dalle orecchie).', 'Tira portando i gomiti verso i fianchi, petto verso la barra.', 'Scendi controllando fino a braccia completamente distese, senza perdere la tensione scapolare.'],
    mistakes: ['Kipping / oscillazione', 'Mezze ripetizioni in alto', 'Spalle che si sollevano in basso'] },
  core: { primary: ['Addominali', 'Trasverso'], secondary: ['Obliqui', 'Flessori dell\'anca', 'Glutei'],
    steps: ['Bacino in retroversione leggera, lombare neutra a contatto o stabile.', 'Muovi solo gli arti mantenendo il tronco immobile; respira in modo continuo.', 'Interrompi la serie appena perdi la posizione della schiena.'],
    mistakes: ['Lombare che si inarca', 'Trattenere il respiro', 'Collo in tensione'] },
};

const OVERRIDES = {
  bw_squat:   { primary: ['Quadricipiti', 'Glutei'], mistakes: ['Scendere poco', 'Peso sulle punte'] },
  split_squat:{ primary: ['Quadricipiti', 'Glutei'], secondary: ['Femorali', 'Stabilizzatori dell\'anca'], steps: ['Piede posteriore su rialzo/indietro, gamba anteriore ben avanti.', 'Scendi verticale finché il ginocchio posteriore sfiora il pavimento.', 'Spingi con il tallone anteriore per risalire.'], mistakes: ['Ginocchio anteriore che cede in dentro', 'Busto troppo inclinato'] },
  leg_ext:    { primary: ['Quadricipiti'], secondary: [], steps: ['Regola il cuscino sopra le caviglie, ginocchio allineato al perno della macchina.', 'Estendi fino a gamba dritta con pausa di un secondo.', 'Scendi lentamente (3 s) senza far toccare il pacco pesi.'], mistakes: ['Slancio', 'Sollevare il bacino dal sedile'] },
  leg_press:  { primary: ['Quadricipiti', 'Glutei'], secondary: ['Femorali'], steps: ['Piedi al centro della pedana, larghezza spalle.', 'Scendi finché le ginocchia sono a 90° senza staccare il bacino dallo schienale.', 'Spingi con tutto il piede senza bloccare le ginocchia in estensione.'], mistakes: ['Bacino che si stacca (schiena arrotonda)', 'Bloccare le ginocchia'] },
  rdl:        { primary: ['Femorali', 'Glutei'], secondary: ['Lombari'], steps: ['In piedi con la barra, ginocchia leggermente flesse e fisse.', 'Spingi le anche indietro scendendo con la barra lungo le gambe, schiena neutra.', 'Fermati quando senti tirare i femorali (di solito sotto il ginocchio), risali con i glutei.'], mistakes: ['Piegare le ginocchia (diventa uno stacco)', 'Arrotondare la schiena', 'Barra lontana'] },
  hip_thrust: { primary: ['Glutei'], secondary: ['Femorali', 'Core'], steps: ['Scapole appoggiate alla panca, barra sulle anche (usa un cuscino).', 'Spingi con i talloni fino a bacino in linea con spalle e ginocchia.', 'Contrai forte i glutei in alto per 1 s, mento verso il petto.'], mistakes: ['Iperestendere la lombare in alto', 'Spingere con le punte'] },
  glute_bridge:{ primary: ['Glutei'], secondary: ['Femorali', 'Core'], steps: ['Supino, ginocchia piegate, piedi vicino ai glutei.', 'Solleva il bacino spingendo con i talloni fino ad allineare spalle-anche-ginocchia.', 'Tieni 2 s contraendo i glutei, scendi lentamente.'], mistakes: ['Inarcare la lombare', 'Spingere con le punte'] },
  leg_curl:   { primary: ['Femorali'], secondary: ['Polpacci'], steps: ['Cuscino sopra i talloni, ginocchia allineate al perno.', 'Fletti portando i talloni verso i glutei senza sollevare il bacino.', 'Rilascia lentamente in 3 s.'], mistakes: ['Bacino che si solleva', 'Slancio'] },
  nordic:     { primary: ['Femorali'], secondary: ['Glutei', 'Polpacci'], steps: ['In ginocchio, caviglie bloccate, corpo dritto dalle ginocchia alla testa.', 'Scendi in avanti il più lentamente possibile frenando con i femorali.', 'Usa le mani per tornare su (assistenza).'], mistakes: ['Piegare le anche', 'Cadere senza controllo'] },
  pushup:     { primary: ['Pettorali', 'Tricipiti'], secondary: ['Deltoidi anteriori', 'Core'], steps: ['Mani poco più larghe delle spalle, corpo in linea dalla testa ai talloni.', 'Scendi fino a sfiorare il pavimento con il petto, gomiti a 45°.', 'Spingi tornando su senza far cadere le anche.'], mistakes: ['Anche che cedono', 'Collo che si allunga verso il pavimento', 'Mezze ripetizioni'] },
  diamond_pushup: { primary: ['Tricipiti', 'Pettorali'], secondary: ['Deltoidi anteriori', 'Core'], mistakes: ['Gomiti che si aprono', 'Anche che cedono'] },
  dips:       { primary: ['Pettorali', 'Tricipiti'], secondary: ['Deltoidi anteriori'], steps: ['Braccia tese sulle parallele, busto leggermente inclinato in avanti.', 'Scendi fino a spalla sotto il gomito, controllando.', 'Spingi tornando su, senza bloccare i gomiti con violenza.'], mistakes: ['Scendere troppo con spalle rigide', 'Oscillare'] },
  chair_dips: { primary: ['Tricipiti'], secondary: ['Pettorali', 'Deltoidi anteriori'], mistakes: ['Spalle che salgono', 'Scendere troppo'] },
  cable_fly:  { primary: ['Pettorali'], secondary: ['Deltoidi anteriori'], steps: ['Un passo avanti, busto leggermente inclinato, gomiti quasi tesi e fissi.', 'Chiudi le mani davanti al petto con un movimento ad arco.', 'Apri controllando fino a sentire l\'allungamento del petto.'], mistakes: ['Piegare i gomiti (diventa una spinta)', 'Spalle in avanti'] },
  lat_raise:  { primary: ['Deltoidi laterali'], secondary: ['Trapezio'], steps: ['Manubri ai fianchi, gomiti leggermente flessi.', 'Alza lateralmente fino all\'altezza delle spalle, mignolo leggermente più alto.', 'Scendi in 2-3 s.'], mistakes: ['Slancio con il busto', 'Trapezio che tira (spalle su)', 'Carico eccessivo'] },
  band_lat_raise: { primary: ['Deltoidi laterali'], secondary: ['Trapezio'], mistakes: ['Slancio', 'Spalle su'] },
  pike_pushup:{ primary: ['Deltoidi', 'Tricipiti'], secondary: ['Trapezio', 'Core'], steps: ['Posizione a V rovesciata, anche alte, mani larghezza spalle.', 'Piega i gomiti portando la testa verso il pavimento davanti alle mani.', 'Spingi tornando in V.'], mistakes: ['Anche basse (diventa un piegamento)', 'Gomiti troppo aperti'] },
  wall_hs_hold:{ primary: ['Deltoidi', 'Tricipiti'], secondary: ['Core', 'Trapezio'], steps: ['Mani a 20 cm dal muro, sali con calcio controllato o camminando con i piedi sul muro.', 'Spingi il pavimento via, corpo in linea, tieni la posizione.', 'Scendi controllando.'], mistakes: ['Schiena inarcata', 'Gomiti flessi'] },
  inv_row:    { primary: ['Dorsali', 'Romboidi'], secondary: ['Bicipiti', 'Core'], steps: ['Sotto la barra, corpo dritto, talloni a terra.', 'Tira il petto verso la barra portando i gomiti indietro.', 'Scendi controllando senza far cadere le anche.'], mistakes: ['Anche che cedono', 'Collo che si protende'] },
  towel_row:  { primary: ['Dorsali', 'Romboidi'], secondary: ['Bicipiti', 'Avambracci'], mistakes: ['Slancio', 'Anche che cedono'] },
  face_pull:  { primary: ['Deltoidi posteriori', 'Romboidi'], secondary: ['Cuffia dei rotatori', 'Trapezio medio'], steps: ['Corda all\'altezza del viso, presa con i pollici verso di te.', 'Tira verso la fronte aprendo i gomiti verso l\'esterno, scapole insieme.', 'Rilascia lentamente.'], mistakes: ['Carico eccessivo', 'Gomiti bassi'] },
  band_face_pull: { primary: ['Deltoidi posteriori', 'Romboidi'], secondary: ['Cuffia dei rotatori'], mistakes: ['Gomiti bassi', 'Slancio'] },
  cable_row:  { primary: ['Dorsali', 'Romboidi'], secondary: ['Bicipiti', 'Lombari'], steps: ['Seduto, busto verticale, ginocchia leggermente flesse.', 'Tira la maniglia all\'addome portando i gomiti indietro e le scapole insieme.', 'Rilascia lasciando che le scapole si aprano, senza inclinare troppo il busto.'], mistakes: ['Oscillare con il busto', 'Spalle in avanti'] },
  lat_pulldown:{ primary: ['Dorsali'], secondary: ['Bicipiti', 'Romboidi'], steps: ['Cosce bloccate sotto i cuscini, presa più larga delle spalle.', 'Tira la barra al petto (non dietro la nuca) portando i gomiti in basso.', 'Risali controllando fino a braccia tese.'], mistakes: ['Busto che si inclina troppo indietro', 'Tirare dietro la nuca'] },
  band_pulldown:{ primary: ['Dorsali'], secondary: ['Bicipiti'], mistakes: ['Slancio', 'Spalle su'] },
  bicep_curl: { primary: ['Bicipiti'], secondary: ['Avambracci'], steps: ['Gomiti ai fianchi, fissi per tutto il movimento.', 'Fletti fino a contrazione completa senza muovere le spalle.', 'Scendi in 2-3 s fino a braccio disteso.'], mistakes: ['Slancio con il busto', 'Gomiti che avanzano'] },
  band_curl:  { primary: ['Bicipiti'], secondary: ['Avambracci'], mistakes: ['Slancio', 'Gomiti che avanzano'] },
  plank:      { primary: ['Trasverso', 'Addominali'], secondary: ['Glutei', 'Deltoidi'], steps: ['Avambracci a terra, gomiti sotto le spalle, corpo in linea.', 'Contrai glutei e addome, spingi il pavimento con gli avambracci.', 'Respira normalmente; fermati quando le anche cedono.'], mistakes: ['Anche alte o basse', 'Trattenere il respiro'] },
  deadbug:    { primary: ['Trasverso', 'Addominali'], secondary: ['Flessori dell\'anca'], steps: ['Supino, braccia verso il soffitto, anche e ginocchia a 90°.', 'Lombare a contatto con il pavimento; estendi lentamente braccio e gamba opposti.', 'Torna e alterna, senza mai staccare la lombare.'], mistakes: ['Lombare che si stacca', 'Andare troppo veloce'] },
  hanging_raise:{ primary: ['Addominali', 'Flessori dell\'anca'], secondary: ['Avambracci', 'Dorsali'], steps: ['Appeso alla sbarra, scapole attive.', 'Solleva le gambe (o le ginocchia) arrotondando il bacino verso l\'alto.', 'Scendi controllando senza oscillare.'], mistakes: ['Oscillazione', 'Sollevare solo le gambe senza retroversione'] },
  tricep_ext: { primary: ['Tricipiti'], secondary: [], steps: ['Manubrio sopra la testa a due mani, gomiti vicini alle orecchie.', 'Piega i gomiti portando il peso dietro la nuca.', 'Estendi fino a braccia tese tenendo i gomiti fermi.'], mistakes: ['Gomiti che si aprono', 'Inarcare la schiena'] },
  ohp:        { mistakes: ['Inarcare la lombare', 'Barra che passa davanti al viso invece che sopra', 'Gomiti sotto i polsi persi'] },
  bench:      { mistakes: ['Gomiti a 90°', 'Rimbalzo sul petto', 'Piedi instabili'] },
  pullup:     { mistakes: ['Kipping', 'Mento che si allunga sopra la barra', 'Non distendere in basso'] },
  deadlift:   { mistakes: ['Schiena arrotondata', 'Barra lontana dalle tibie', 'Anche che salgono prima delle spalle'] },
};

export function exerciseInfo(ex) {
  const base = P[ex.pattern] ?? P.core;
  return { ...base, ...(OVERRIDES[ex.id] ?? {}) };
}
