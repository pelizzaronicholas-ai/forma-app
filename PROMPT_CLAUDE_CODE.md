# Prompt per Claude Code — NutriCoach

Copia tutto il blocco qui sotto e incollalo come primo messaggio in Claude Code aperto nella cartella `nutricoach/`.

---

Sei un senior product engineer + UI designer. Lavori nella cartella corrente, che contiene una PWA funzionante chiamata **NutriCoach** (vedi `PROGETTO.md` e `README.md` prima di toccare qualsiasi cosa). Il tuo compito è portarla a livello di prodotto pubblico: **molto più bella, più fluida, più "app vera"**, senza rompere i motori esistenti.

## Cosa esiste già (NON riscrivere da zero)

- `engine/nutrition.js` — BMR/TDEE/target/macro/pasti, testato. Le formule e i guardrail sono definitivi.
- `engine/training.js` — split, DB esercizi, progressione, sostituzioni.
- `engine/foods.js` — mini DB alimenti e piano a regole (fallback offline).
- `engine/schemas.js` — contratti tool-use per l'LLM, validazione, controllo allergeni.
- `engine/shopping.js` — lista spesa aggregata per reparto.
- `engine/moves.js` — animazioni SVG dei movimenti (cinematica da angoli) + schede esercizio.
- `engine/foodIcons.js` — mappa alimento → emoji.
- `backend/worker.js` — Cloudflare Worker proxy verso API Anthropic con tool use forzato.
- `app.js`, `ui.css`, `index.html` — UI vanilla JS attuale, tema nero/grigio con giallo fluo `#e8ff00` e verde lime `#9dff1c`.
- `test/` — 42 test con `node --test`. Devono restare verdi.

Prima di tutto: esegui `npm test`, apri l'app con `python3 -m http.server 8080`, fai il questionario, guarda ogni tab con Playwright/screenshot e prendi nota di cosa è brutto o goffo.

## Obiettivo di prodotto

App "personal trainer + nutrizionista di fiducia": l'utente inserisce altezza, peso, età, attività, obiettivo, 3 o 5 pasti, allergie e cibi sgraditi, tempo per allenarsi e per cucinare; l'app calcola il fabbisogno, crea la dieta settimanale personalizzata (sostituibile alimento per alimento), il programma di allenamento con il movimento di ogni esercizio, le preparazioni dei pasti e la lista della spesa settimanale per arrivare al risultato deciso nella fase di conoscenza iniziale.

## Direzione visiva (obbligatoria)

Palette: nero `#0a0a0b`, grigi `#17181b / #1f2024 / #2a2c31`, giallo fluo `#e8ff00`, verde lime `#9dff1c`. Bianco solo per testo. Nessun altro colore saturo salvo rosso per errori.

Riferimenti di stile da cui prendere ispirazione (cerca screenshot online e studiali, non copiare layout 1:1): **Fitbod** (schede esercizio, progressione), **Freeletics** (tipografia forte, dark, energia), **Nike Training Club** (hero card, ritmo delle sezioni), **Yazio / Lifesum** (piano pasti con immagini grandi, anelli macro, lista spesa), **Whoop / Strava** (dashboard dati, grafici puliti su fondo scuro).

Regole:
- Tipografia: titoli grandi, pesanti, maiuscoli con tracking stretto; numeri chiave enormi in giallo fluo con glow leggero.
- Card con profondità reale: gradienti scuri, bordo 1px, ombra portata, highlight interno. Le card degli alimenti devono sembrare oggetti 3D (emoji Apple grande con drop-shadow doppio, sfondo radiale colorato per categoria).
- Micro-animazioni: transizioni tra tab, ingresso card a cascata, anelli macro che si riempiono, tap feedback. `prefers-reduced-motion` rispettato.
- Mobile-first (390px), ma su desktop layout a due colonne.
- Zero librerie pesanti. Vanilla JS o al massimo Preact via CDN se semplifica davvero. Niente build step obbligatorio.

## Funzionalità da aggiungere / migliorare

1. **Dashboard Oggi**: anello kcal (consumate vs target) + tre anelli macro; checkbox "pasto fatto" per ogni pasto che aggiorna gli anelli; card allenamento del giorno con anteprima animata del primo esercizio; grafico peso ultime 8 settimane (SVG, senza librerie).
2. **Piano**: vista settimana a scorrimento orizzontale; card alimento 3D con tap → sheet "sostituisci con…" che mostra 3-4 alternative equivalenti (usa `availableFoods` + riscalatura) invece di sostituire a caso; "Preparazione" come bottom sheet con step numerati e timer opzionale.
3. **Allenamento**: scheda esercizio full-screen con animazione grande, muscoli evidenziati su una silhouette SVG (fronte/retro), esecuzione, errori; modalità "Allenati" con timer di recupero, contatore serie, registrazione carichi/ripetizioni e proposta automatica del carico successivo (double progression, già in `progressionRules`).
4. **Spesa**: raggruppata per reparto con icona alimento, spunte persistenti, "già in dispensa", condivisione testo/WhatsApp, quantità arrotondate a confezioni.
5. **Progressi**: peso, misure opzionali, aderenza settimanale, ricalcolo automatico ogni 14 giorni (`adjustTarget` esiste già) con spiegazione in linguaggio umano.
6. **Onboarding**: 6 step con illustrazioni/animazioni, validazione, riepilogo "il tuo piano" con conto alla rovescia verso l'obiettivo (settimane stimate).
7. **Backend**: mantieni il Worker; aggiungi in Profilo un test di connessione e un contatore generazioni residue.

## Vincoli non negoziabili

- Tutti i numeri li calcola `engine/nutrition.js`. Il modello (o il fallback a regole) propone solo alimenti; ogni pasto viene riscalato con `scaleMealToTarget` e controllato con `validatePlan` / `findAllergenViolations`.
- Le allergie sono assolute. Nessun alimento derivato può comparire.
- Disclaimer visibile in onboarding e in Profilo: strumento educativo, non dispositivo medico, non sostituisce un professionista.
- Niente tracking, niente cookie di terzi, niente font esterni (system font stack).
- Tutto in italiano nell'interfaccia; codice, variabili e commenti tecnici in inglese, commenti esplicativi in italiano come nel codice esistente.
- Ogni modifica ai motori deve avere un test. `npm test` sempre verde.

## Metodo di lavoro

Lavora per milestone piccole e verificabili: dopo ogni milestone esegui i test, apri l'app in Chromium headless, fai screenshot di ogni vista a 390px e a 1200px, guardali e correggi quello che non regge il confronto con le app di riferimento. Committa con messaggi chiari. Non chiedermi conferme per scelte di design: decidi tu in coerenza con la direzione sopra, e spiegami alla fine cosa hai fatto e cosa resta.

Parti dalla dashboard Oggi e dalla scheda esercizio full-screen, che sono le due schermate che definiscono il prodotto.

---
