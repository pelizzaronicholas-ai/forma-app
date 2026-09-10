# FORMA — documento di progetto

> Nome scelto: **FORMA** (in forma / dare forma). Logo: `branding/forma.svg`. Palette: nero `#0a0a0b`, giallo fluo `#e8ff00`, lime `#9dff1c`.

PWA che calcola il fabbisogno calorico, genera un piano alimentare settimanale personalizzato (3 o 5 pasti, allergie ed esclusioni), un programma di allenamento in base a giorni/minuti/attrezzatura, le preparazioni dei pasti e la lista della spesa settimanale. Pensata come prodotto pubblico.

## Principio architetturale

**Il codice calcola, il modello propone, il codice controlla.**

Tutti i numeri (BMR, TDEE, target kcal, macro, distribuzione per pasto) sono deterministici e testati (`engine/nutrition.js`). L'LLM viene usato solo per la parte "creativa" — scegliere alimenti reali, comporre pasti vari, scrivere preparazioni, adattare il programma a infortuni — e riceve i vincoli numerici come input rigido. La risposta arriva via *tool use* con schema JSON (`engine/schemas.js`), viene validata (`validatePlan`), controllata per allergeni (`findAllergenViolations`) e riscalata in codice al target kcal esatto (`scaleMealToTarget`). Se il modello sbaglia, il backend chiede una correzione una volta, poi riscala.

Senza backend l'app funziona comunque con un generatore a regole (`engine/foods.js`) su un mini DB alimenti: è il fallback offline e la modalità demo.

## Struttura

```
forma/
├── index.html, ui.css, app.js      PWA (vanilla JS, ES modules, nessun build step)
├── store.js                        persistenza locale (localStorage, interfaccia sostituibile)
├── api.js                          client verso il Worker con fallback a regole
├── sw.js, manifest.webmanifest     offline + installabilità
├── engine/
│   ├── nutrition.js                BMR/TDEE/target/macro/pasti + ricalcolo periodico
│   ├── training.js                 split, DB esercizi, progressione, sostituzioni
│   ├── foods.js                    mini DB alimenti + piano a regole (fallback)
│   ├── schemas.js                  contratti tool-use LLM + validazione + allergeni
│   └── shopping.js                 aggregazione lista spesa per reparto/confezione
├── backend/
│   ├── worker.js                   Cloudflare Worker: proxy Anthropic, auth, rate limit
│   └── wrangler.toml
└── test/                           node --test (42 test)
```

## Motore nutrizionale (deterministico)

| Passo | Formula / regola | Guardrail |
|---|---|---|
| BMR | Mifflin-St Jeor; Katch-McArdle se % grasso nota | — |
| TDEE | BMR × fattore attività (1.2 → 1.9) | — |
| Target | cut: −(peso × ritmo% × 7700)/7; bulk: metà del ritmo | deficit ≤ 25% TDEE, mai < 1.1×BMR né < 1200 F / 1500 M; surplus ≤ 15% TDEE |
| Proteine | 2.2 g/kg cut, 1.8 maintain/bulk | con BF > 30% si usa peso di riferimento = LBM/0.75 |
| Grassi | 0.8–1.0 g/kg | scendono a 0.7 prima di accettare carbo < 100 g |
| Carbo | residuo | avviso se < 100 g |
| Pasti | 3: 30/40/30% — 5: 25/10/30/10/25% | proteine distribuite più uniformi delle kcal, spuntini 15% cad. |
| Ricalcolo | ogni 2 settimane: Δpeso reale vs atteso, ±100 kcal se fuori tolleranza ±0.3 kg/sett | — |

## Motore allenamenti (template)

Split scelto da giorni e livello: ≤3 full body, 4 upper/lower, 5 PPL+UL, 6 PPL (principianti e corpo libero restano su upper/lower). Esercizi per seduta in base ai minuti (30→4, 45→5, 60→6, 90→7). Ogni seduta è una lista di *pattern* (squat, hinge, h_push, v_push, h_pull, v_pull, core) con tier richiesto; il DB (`EXERCISES`) fornisce l'esercizio compatibile con l'attrezzatura, ruotando le varianti tra sedute A/B/C. Serie × rep per obiettivo (forza 4-6, ipertrofia 8-12, resistenza 12-20) e livello. Progressione: double progression, scarico ogni 5-8 settimane. `substituteExercise` sostituisce nello stesso pattern senza LLM; l'LLM (`/adapt-training`) interviene solo per descrizioni libere (infortuni) e può scegliere **solo id dal DB**.

## Contratti LLM (tool use)

Quattro tool, `tool_choice` forzato, modello `claude-sonnet-4-5`:

- `submit_weekly_plan` — input: profilo, preferenze, target per slot. Output: 7 giorni × pasti × alimenti con grammi e macro.
- `submit_substitution` — input: pasto, target, alimento da togliere. Output: pasto modificato.
- `submit_recipes` — input: pasti con ingredienti. Output: passi, minuti, consigli, meal prep.
- `submit_training_adaptation` — input: programma, problemi utente, DB esercizi. Output: sostituzioni per id.

Costo stimato per piano settimanale: 4-6k token output ≈ 3-5 centesimi. Rate limit default 20 chiamate/utente/giorno (KV).

## Backend

Cloudflare Worker (`backend/worker.js`). Secret `ANTHROPIC_API_KEY` mai esposto. Auth: Bearer JWT Supabase verificato HS256 con `SUPABASE_JWT_SECRET` (o `DEV_TOKEN` in sviluppo). CORS da restringere al dominio della PWA in produzione.

```
cd backend
npm i -g wrangler && wrangler login
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put DEV_TOKEN          # per provare senza Supabase
wrangler deploy
```

Poi nella PWA → Profilo → URL Worker + token.

## Schema dati (localStorage oggi, Supabase domani)

```
profile   { weightKg, heightCm, age, sex, bodyFatPct?, activity, goal, pace, mealsPerDay,
            allergies[], dislikes[], cookingMinutes, daysPerWeek, minutesPerSession,
            equipment, level, trainingGoal }
numbers   { bmr, tdee, target, dailyDelta, expectedWeeklyChangeKg, macros{}, meals[], warnings[] }
mealPlan  { days[7]{ day, meals[]{ slot, title, items[]{ name, grams, category, kcal, protein, carbs, fat } } }, notes, source }
program   { split, sessions[]{ label, exercises[]{ id, name, pattern, sets, repMin, repMax, restSec } }, progression }
shopping  { checked{}, pantry[] }
weights   [{ date, kg }]
recipes   { [mealTitle]: { minutes, steps[], tips, mealPrep } }
```

Per Supabase: tabelle `profiles`, `plans` (jsonb + created_at), `weights`; RLS per user_id. Il frontend salva sempre in locale e sincronizza quando online.

## Milestone

1. ✅ Onboarding, motore calorico, dashboard
2. ✅ Backend + generazione piano + sostituzioni (da deployare)
3. ✅ Allenamenti a template + adattamento LLM
4. ✅ Preparazioni + lista spesa
5. ◻ Progressi: grafico peso, aderenza, foto, ricalcolo automatico (base già presente)
6. ◻ Auth Supabase, sync, pagamenti (freemium: piano a regole gratis, AI a pagamento)
7. ◻ Legale: disclaimer, privacy policy (dati sanitari GDPR art. 9), parere professionista
8. ◻ Icone/splash iOS, store listing (Capacitor se serve App Store)

## Cose da sapere / limiti attuali

- Il DB alimenti a regole è volutamente piccolo (~45 voci): serve come fallback, non come prodotto. Il piano "vero" arriva dal modello.
- Le kcal per alimento nel piano LLM sono stimate dal modello: la riscalatura in codice garantisce il totale del pasto, non la precisione del singolo alimento. Per precisione da etichetta serve un DB (CREA/USDA/Open Food Facts) e far scegliere al modello solo id, come già fatto per gli esercizi.
- In Italia l'elaborazione di diete è atto riservato (medici, biologi, dietisti). L'app va posizionata come strumento educativo/di supporto. Serve un parere legale prima del lancio pubblico.
- `localStorage` ha limite ~5 MB: sufficiente per anni di dati, ma senza sync tra dispositivi finché non c'è Supabase.
