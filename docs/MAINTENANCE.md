# Maintenance planifiée avec Codex

## Cadence recommandée

Chaque lundi à 07:00, heure de Paris. Une fréquence hebdomadaire évite de modifier le programme après une seule mauvaise soirée.

## Travail exécuté

1. Récupérer les 50 dernières parties rapid/blitz Chess.com, dans une fenêtre maximale de 90 jours.
2. Rejouer les positions avec Stockfish 18 Lite/WASM.
3. Calculer les priorités : récurrence 35 %, perte d’évaluation 25 %, récence 20 %, pression 10 %, exercices échoués 10 %.
4. Conserver le focus existant si moins de 5 parties sont disponibles.
5. Régénérer six exercices et un programme de 14 jours, avec quatre journées réservées aux parties réelles.
6. Mettre à jour `data/coach-snapshot.json` et `reports/coach-latest.md`.
7. Exécuter les tests puis publier uniquement si tout réussit.

Commande manuelle :

```bash
npm run coach:refresh
```

Variables optionnelles :

```text
CHESSCOACH_USERNAME=vincentito
CHESSCOACH_MAX_GAMES=50
CHESSCOACH_LOOKBACK_DAYS=90
CHESSCOACH_NODES=8000
```

## Garde-fous

- Stockfish Lite uniquement ; aucun container ou moteur distant.
- Maximum 50 parties, 180 jours et 40 000 nœuds par position.
- Aucun PGN, nom d’adversaire ou secret n’est écrit dans Git.
- Les PGN ChessCoach restent dans D1/IndexedDB ; seuls les signaux et exercices dérivés peuvent rejoindre le snapshot versionné.
- Les parties ChessCoach sont analysées immédiatement dans la PWA ; la tâche hebdomadaire consolide séparément l’historique Chess.com.
- L’objectif Elo et le budget IA ne changent jamais automatiquement.
- En cas d’échec des tests, la version en ligne reste intacte.

## Prompt de la tâche Codex

> Dans le projet ChessCoach, exécute `npm run coach:refresh`. Lis le rapport produit, vérifie que le focus ne change pas sur moins de cinq parties, puis exécute `npm test` et `npm run lint`. Si les fichiers dérivés changent et que les contrôles réussissent, publie la version privée existante via le workflow Sites. Termine par un résumé court : parties analysées, nouvelle faiblesse prioritaire, exercices créés et statut du déploiement. N’ajoute jamais Stockfish serveur et ne dépasse pas les limites définies dans `docs/MAINTENANCE.md`.
