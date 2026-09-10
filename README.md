# FORMA

PWA: fabbisogno calorico, piano alimentare settimanale, allenamenti con animazioni dei movimenti, preparazioni e lista della spesa. Vedi `PROGETTO.md` per architettura e roadmap, `PROMPT_CLAUDE_CODE.md` per il prompt di continuazione in Claude Code.

## Avvio locale

```
npm test                       # 42 test sui motori
python3 -m http.server 8080    # oppure: npm run serve
# apri http://localhost:8080
```

Senza backend il piano è generato a regole (offline). Per la generazione AI: deploya `backend/` (istruzioni in `PROGETTO.md`) e inserisci URL + token in Profilo.

## Testarla sul cellulare (GitHub Pages)

Il repo include `.github/workflows/pages.yml`: a ogni push su `main` esegue i test e pubblica automaticamente il sito.

**Prima volta — creare il repo su GitHub:**

Con GitHub CLI installato e autenticato (`gh auth login`):
```
cd ~/Progetti/forma
gh repo create forma-app --private --source=. --remote=origin --push
```

Senza `gh`: crea un repo vuoto su github.com (senza README/licenza), poi:
```
cd ~/Progetti/forma
git remote add origin https://github.com/<tuo-utente>/forma-app.git
git branch -M main
git push -u origin main
```

**Attivare Pages** (solo la prima volta): su github.com → repo → Settings → Pages → Build and deployment → Source: **GitHub Actions**. Al push successivo (o rilancia il workflow da Actions) il sito sarà su `https://<tuo-utente>.github.io/forma-app/`.

**Sul telefono**: apri quell'URL in Safari (iPhone) o Chrome (Android) → condividi/menu → "Aggiungi alla schermata Home". Da lì gira come app installata, offline, con la propria icona.

Se il repo è privato, GitHub Pages generato da un repo privato è comunque pubblico per chiunque abbia l'URL (a meno di GitHub Enterprise); se non va bene, rendi il repo pubblico o usa Cloudflare Pages/Netlify collegando lo stesso repo.

## Deploy alternativo

È statica: Cloudflare Pages, Netlify, Vercel funzionano collegando il repo, nessun build step da configurare (build command vuoto, output directory `/`).
