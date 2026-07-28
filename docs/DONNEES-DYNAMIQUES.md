# Données dynamiques et paramètres en dur

## Données utilisateur

Le runtime ne charge plus de snapshot initial. Le profil, l’Elo, les parties, les tentatives, les exercices, les faiblesses et les séances viennent de D1 et d’IndexedDB. L’Elo est lu dans les statistiques Chess.com, persisté dans `profiles`, puis vérifié à partir de la dernière partie blitz importée.

Le fichier historique `data/coach-snapshot.json` a été supprimé. La tâche de maintenance reconstruit désormais son export depuis Chess.com sans reprendre un ancien état.

## Paramètres produit encore en dur

- Objectif initial : 1500 blitz ; durée quotidienne : 20 minutes.
- Programme : 14 jours ; journées de partie réelle aux jours 3, 6, 10 et 13.
- Priorité coach : récurrence 35 %, perte d’évaluation 25 %, récence 20 %, pression 10 %, échecs aux exercices 10 %.
- Import : 300 parties maximum ; cache cloud : 350 parties, 30 plans, 50 exercices et 500 tentatives.
- Classification moteur : ouverture jusqu’au 20e demi-coup, finale à 10 pièces ou moins, tactique à partir de 150 centipions.
- Stockfish Lite : profondeurs, temps de calcul et niveaux proposés dans l’interface.
- Voix IA : modèle `gpt-realtime-2.1-mini`, voix `marin`.
- Cadences, textes d’interface et seuils de répétition espacée.

Ces valeurs sont des règles produit, pas des données personnelles. La prochaine étape recommandée est de les centraliser dans une configuration administrable.
