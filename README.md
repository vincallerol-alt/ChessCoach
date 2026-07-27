# ChessCoach

PWA mobile-first de coaching d’échecs personnel. La séance quotidienne de 20 minutes combine erreurs personnelles, répétition espacée, exercices ciblés, mini-partie et bilan.

## Démarrage

```bash
npm install
npm run dev
```

### Depuis un téléphone sur le même Wi‑Fi

```bash
npm run dev:mobile
```

Puis ouvrir l’adresse `Network` affichée dans le terminal. Le PC doit rester allumé et le serveur actif.

- Application PWA : Vinext/React 19, TypeScript, `react-chessboard`, `chess.js`, Dexie.
- Données : import public Chess.com, cache IndexedDB et stockage D1 multi-utilisateur.
- Jeu hors ligne : Stockfish 18 Lite single-threaded WASM (GPLv3, licence incluse dans `public/engine/COPYING.txt`).
- Analyse lourde : service Fastify dans `server/`, à lancer avec `STOCKFISH_PATH` pointant vers un binaire Stockfish 18 complet.

## Commandes

```bash
npm test
npm run lint
npm run db:generate
npm run engine
```

La couche `CoachNarrator` est déterministe au MVP. Elle peut être remplacée plus tard par un coach Codex/OpenAI sans modifier l’analyse Stockfish ni l’algorithme de planification.
