# FORMA

PWA: fabbisogno calorico, piano alimentare settimanale, allenamenti, preparazioni e lista della spesa. Vedi `PROGETTO.md` per architettura e roadmap.

## Avvio locale

```
npm test                       # 42 test sui motori
python3 -m http.server 8080    # oppure: npx serve -l 8080
# apri http://localhost:8080
```

Senza backend il piano è generato a regole (offline). Per la generazione AI: deploya `backend/` (istruzioni in `PROGETTO.md`) e inserisci URL + token in Profilo.

## Deploy PWA

È statica: GitHub Pages, Cloudflare Pages, Netlify. Nessun build step. Serve HTTPS per il service worker e l'installazione su iPhone (Safari → Condividi → Aggiungi alla schermata Home).
