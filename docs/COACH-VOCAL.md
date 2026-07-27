# Coach vocal

ChessCoach utilise une session OpenAI Realtime speech-to-speech via WebRTC. Cette architecture apporte une faible latence, des tours de parole naturels et l’interruption immédiate du coach lorsque le joueur reprend la parole.

## Qualité

- modèle `gpt-realtime-2.1-mini` avec raisonnement faible pour réduire le coût tout en conservant une conversation fluide ;
- voix `marin`, ton calme et réponses courtes ;
- transcription française enrichie avec le vocabulaire échiquéen ;
- réduction du bruit de proximité et détection sémantique des tours de parole ;
- lecture de la FEN et du contexte Stockfish courant avant chaque analyse ;
- notation algébrique reformulée pour être compréhensible à l’oral.

## Sécurité et confidentialité

La clé `OPENAI_API_KEY` reste sur le serveur. Au démarrage d’une conversation, `/api/realtime/token` crée un jeton OpenAI éphémère. Seul ce jeton temporaire atteint le navigateur.

Le microphone ne démarre qu’après une action explicite du joueur. Il peut être coupé ou arrêté depuis l’interface. Le mode texte reste disponible si le micro est refusé, hors ligne ou indisponible.

## Parcours

1. Le joueur touche **Parler au coach** et autorise le microphone.
2. Le coach écoute automatiquement et détecte la fin de la question.
3. Avant l’analyse, l’agent lit la position et les données Stockfish affichées.
4. Le coach répond oralement et affiche la transcription.
5. Le joueur peut interrompre la réponse, couper le micro ou terminer la session.
