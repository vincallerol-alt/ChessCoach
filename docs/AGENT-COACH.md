# Agent coach ChessCoach

## Rôle

L’agent OpenAI explique et questionne ; Stockfish Lite reste la source de vérité pour l’évaluation et les meilleurs coups.

Contexte envoyé à l’agent :

- FEN courante ;
- étape et objectif de séance ;
- coup joué et meilleur coup Stockfish, lorsqu’il est disponible ;
- perte en centipions et explication déterministe ;
- question du joueur.

Le secret `OPENAI_API_KEY` reste côté serveur. Il n’est jamais envoyé au navigateur.

## Flux live

1. Le joueur fait une erreur.
2. Stockfish fournit le coup joué, le meilleur coup et la perte.
3. L’interface appelle `/api/coach`.
4. L’agent explique la menace, la raison positionnelle et le principe réutilisable.
5. Le joueur rejoue immédiatement la position ou enchaîne la tactique suivante.

Sans clé OpenAI sur l’environnement, l’interface annonce explicitement le mode déterministe.

## Cas d’usage prioritaires

- expliquer une erreur sans révéler immédiatement la solution ;
- comparer deux plans candidats ;
- identifier la menace adverse avant de jouer ;
- expliquer une FEN pendant une partie ou un exercice ;
- lancer une partie depuis une FEN, un PGN ou une suite de coups SAN ;
- transformer une erreur de partie Stockfish en exercice ;
- résumer une séance et définir une intention pour la prochaine partie ;
- adapter la difficulté et la répétition espacée aux tentatives ;
- préparer une mission de jeu Chess.com ciblée ;
- détecter les décisions prises sous pression et proposer une routine courte.

## Garde-fous coût et qualité

- modèle compact `gpt-5-mini` ;
- réponses de deux à cinq phrases ;
- un seul agent et deux tours maximum ;
- aucune analyse moteur confiée au modèle ;
- contexte borné côté API ;
- appels automatiques uniquement après une erreur ; les autres sont déclenchés par le joueur.

La structure suit le principe recommandé par l’Agents SDK : commencer avec un agent spécialisé et n’ajouter outils ou spécialistes que lorsqu’un besoin mesuré le justifie.
