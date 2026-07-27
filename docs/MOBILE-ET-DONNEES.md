# Mobile, données réelles et boucle d’apprentissage

## Partie d’entraînement sur mobile

- Échiquier bord à bord sur les écrans de moins de 680 px.
- Pendules, cadence et force accessibles sous le pouce.
- Historique compact des huit derniers demi-coups.
- Zones sûres Android/iOS via `env(safe-area-inset-*)`.
- Feedback d’exercice maintenu visible au-dessus de la navigation.
- Les étapes replay, révision et série utilisent des positions distinctes.
- Une série tactique enchaîne plusieurs positions sans retour au menu.
- Une étape reste incomplète si aucune position n’est disponible.
- La mini-partie démarre sur la FEN indiquée et oriente l’échiquier du côté du joueur.

## PWA Android

`public/manifest.webmanifest` utilise `display: fullscreen` et `display_override: ["fullscreen", "standalone"]`. Android ouvre donc l’installation comme une application sans barre Chrome lorsque le navigateur et le système le permettent.

## Données réelles

Les compétences viennent du snapshot calculé sur les parties. Les volumes, taux de réussite, série de séances et historique sont calculés depuis les enregistrements réels. Aucun exemple de partie ou pourcentage fictif n’est affiché lorsque les données manquent.

Les libellés « 300 dernières parties » et « 50 analysées » ne servent plus de compteurs. L’interface affiche uniquement les parties présentes et celles dont `analyzed=true`.

## Boucle Stockfish

1. Chaque coup du joueur est analysé localement par un second worker Stockfish Lite.
2. Les pertes supérieures au seuil utile sont classées par ouverture, tactique, stratégie, finale ou temps.
3. Les trois positions les plus critiques sont attachées au PGN.
4. La position prioritaire devient un exercice personnel et adapte la séance active.
5. Les erreurs aux exercices ajustent le signal de faiblesse.

## Synchronisation

- `POST /api/sync` effectue des upserts D1 des parties, séances et exercices.
- `GET /api/sync` restaure parties, séances, exercices et tentatives du compte authentifié.
- IndexedDB conserve un cache complet pour le hors-ligne.
- Les tentatives hors ligne sont envoyées au retour du réseau.

Les colonnes D1 correspondantes sont décrites dans `db/schema.ts` et migrées par `drizzle/0001_cute_tenebrous.sql`.
