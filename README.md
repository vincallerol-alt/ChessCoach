# ChessCoach

PWA mobile-first de coaching d’échecs personnel pour `vincentito`. Elle propose une séance adaptative de 20 minutes, des exercices issus des parties Chess.com et un bot jouable hors ligne.

## Principes du MVP

- Stockfish 18 Lite/WASM uniquement, sur l’appareil : aucun serveur d’échecs.
- Cloudflare Workers + D1 pour l’API et la persistance.
- IndexedDB et service worker pour le mode hors ligne.
- Les parties terminées ou abandonnées contre Stockfish Lite sont conservées dans l’historique local avec leur PGN, résultat et cadence.
- Les exercices proposent un réessai, un indice au deuxième échec puis une solution expliquée au troisième.
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

La couche `EngineAdapter` permet d’ajouter Stockfish complet plus tard sans modifier le coach ni l’interface.
