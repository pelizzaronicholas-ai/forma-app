// engine/foodIcons.js
// Icona per alimento: emoji (render 3D-style su Apple) scelta per parola chiave,
// con fallback per categoria. Copre sia il DB a regole sia i nomi liberi dell'LLM.
// Sostituibile in futuro con render veri: foodImage(name) → url in img/.

const KEYWORDS = [
  // proteine
  ['pollo', '🍗'], ['tacchino', '🍗'], ['manzo', '🥩'], ['bistecca', '🥩'], ['vitello', '🥩'], ['maiale', '🥓'], ['bresaola', '🥩'], ['prosciutto', '🍖'],
  ['salmone', '🐟'], ['merluzzo', '🐟'], ['tonno', '🐟'], ['orata', '🐟'], ['branzino', '🐟'], ['sgombro', '🐟'], ['trota', '🐟'], ['pesce', '🐟'], ['alici', '🐟'], ['sardine', '🐟'],
  ['gamber', '🍤'], ['scampi', '🍤'], ['calamar', '🦑'], ['polpo', '🐙'], ['cozze', '🦪'], ['vongole', '🦪'],
  ['albume', '🥚'], ['uov', '🥚'], ['frittata', '🍳'], ['tofu', '🧈'], ['tempeh', '🧈'], ['seitan', '🥙'],
  ['proteine in polvere', '🥤'], ['whey', '🥤'], ['isolate', '🥤'],
  ['lenticchie', '🫘'], ['ceci', '🫘'], ['fagioli', '🫘'], ['piselli', '🫛'], ['edamame', '🫛'], ['soia', '🫘'],
  // latticini
  ['yogurt', '🥛'], ['skyr', '🥛'], ['latte', '🥛'], ['kefir', '🥛'], ['fiocchi di latte', '🧀'], ['ricotta', '🧀'], ['parmigiano', '🧀'], ['grana', '🧀'], ['formaggio', '🧀'], ['mozzarella', '🧀'], ['feta', '🧀'], ['burro', '🧈'],
  // carboidrati
  ['riso', '🍚'], ['pasta', '🍝'], ['spaghetti', '🍝'], ['patat', '🥔'], ['pane', '🍞'], ['piadina', '🫓'], ['tortilla', '🫓'], ['avena', '🥣'], ['porridge', '🥣'], ['muesli', '🥣'], ['cereali', '🥣'],
  ['quinoa', '🌾'], ['farro', '🌾'], ['orzo', '🌾'], ['couscous', '🌾'], ['bulgur', '🌾'], ['gallette', '🍘'], ['cracker', '🍘'], ['fette biscottate', '🍞'], ['mais', '🌽'], ['polenta', '🌽'], ['pizza', '🍕'],
  // grassi
  ['olio', '🫒'], ['oliv', '🫒'], ['avocado', '🥑'], ['mandorl', '🌰'], ['noci', '🌰'], ['nocciol', '🌰'], ['pistacch', '🌰'], ['anacard', '🌰'], ['arachid', '🥜'], ['burro di arachidi', '🥜'], ['semi', '🌻'], ['cioccolat', '🍫'], ['cacao', '🍫'],
  // verdure
  ['broccol', '🥦'], ['zucchin', '🥒'], ['cetriol', '🥒'], ['spinaci', '🥬'], ['insalata', '🥗'], ['lattuga', '🥬'], ['rucola', '🥬'], ['bieta', '🥬'], ['cavol', '🥬'], ['verza', '🥬'],
  ['pomodor', '🍅'], ['peperon', '🫑'], ['fagiolini', '🫛'], ['carot', '🥕'], ['melanzan', '🍆'], ['cipoll', '🧅'], ['aglio', '🧄'], ['fungh', '🍄'], ['asparag', '🌿'], ['finocch', '🌿'], ['zucca', '🎃'], ['verdur', '🥦'],
  // frutta
  ['banana', '🍌'], ['mela', '🍎'], ['pera', '🍐'], ['arancia', '🍊'], ['mandarin', '🍊'], ['kiwi', '🥝'], ['fragol', '🍓'], ['frutti di bosco', '🫐'], ['mirtill', '🫐'], ['lampon', '🫐'], ['uva', '🍇'], ['pesca', '🍑'], ['albicocc', '🍑'],
  ['anguria', '🍉'], ['melone', '🍈'], ['ananas', '🍍'], ['mango', '🥭'], ['limone', '🍋'], ['ciliegi', '🍒'], ['frutta', '🍎'],
  // altro
  ['miele', '🍯'], ['marmellata', '🍯'], ['caffè', '☕'], ['tè', '🍵'], ['acqua', '💧'], ['spezie', '🧂'], ['sale', '🧂'],
];

const BY_CATEGORY = { protein: '🍗', carb: '🍚', fat: '🫒', veg: '🥦', fruit: '🍎', dairy: '🥛', other: '🍽️' };

export function foodIcon(name, category = 'other') {
  const n = (name ?? '').toLowerCase();
  // Prima le chiavi più lunghe (es. "burro di arachidi" prima di "burro")
  for (const [k, e] of KEYWORDS_SORTED) if (n.includes(k)) return e;
  return BY_CATEGORY[category] ?? BY_CATEGORY.other;
}
const KEYWORDS_SORTED = [...KEYWORDS].sort((a, b) => b[0].length - a[0].length);

export const SLOT_ICON = { breakfast: '🌅', snack1: '🍎', lunch: '☀️', snack2: '🥜', dinner: '🌙' };
