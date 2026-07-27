# ChessCoach

PWA mobile-first de coaching d’échecs personnel pour `vincentito`. Elle propose une séance adaptative de 20 minutes, des exercices issus des parties Chess.com et un bot jouable hors ligne.

## Principes du MVP

- Stockfish 18 Lite/WASM uniquement, sur l’appareil : aucun serveur d’échecs.
- Cloudflare Workers + D1 pour l’API et la persistance.
- IndexedDB et service worker pour le mode hors ligne.
- Les parties terminées ou abandonnées contre Stockfish Lite sont conservées dans l’historique local avec leur PGN, résultat et cadence.
- Les exercices proposent un réessai, un indice au deuxième échec puis une solution expliquée au troisième.
- Android lance la PWA installée en plein écran lorsque le système le permet.
- D1 synchronise parties, séances, exercices et tentatives entre appareils ; IndexedDB sert de cache hors ligne.
- Les parties Stockfish sont analysées localement et peuvent créer immédiatement un exercice personnel.
- Le coach OpenAI explique en direct une position ou une erreur à partir du contexte Stockfish.
- Les séances sont différenciées et les séries tactiques enchaînent plusieurs positions.
- Une partie peut démarrer depuis une FEN, un PGN ou une suite de coups SAN.
- Maintenance hebdomadaire par Codex, avec un minimum de 5 parties avant de changer le focus.
- Les PGN et noms d’adversaires ne sont jamais enregistrés dans Git.

## Démarrage local

```bash
npm install
npm run dev
```

Sur le même Wi-Fi :

```bash
npm run dev:mobile
```

## Commandes utiles

```bash
npm test
npm run lint
npm run coach:refresh
```

## Documentation

- [Installer la PWA sur téléphone](docs/INSTALLATION.md)
- [Architecture et diagrammes de flux](docs/ARCHITECTURE.md)
- [Maintenance planifiée avec Codex](docs/MAINTENANCE.md)
- [Mobile, données réelles et synchronisation](docs/MOBILE-ET-DONNEES.md)
- [Agent coach OpenAI](docs/AGENT-COACH.md)

La couche `EngineAdapter` permet d’ajouter Stockfish complet plus tard sans modifier le coach ni l’interface.
