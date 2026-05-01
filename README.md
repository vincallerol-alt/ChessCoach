# SauveParent MVP

Prototype audio-first d'agent vocal conteur pour enfants.

## Lancer

Ouvrir `index.html` dans un navigateur moderne.

## Ce qui est implémenté

- Configuration parent : âge réel, prénom, durée, voix, thèmes, apprentissages et sujets interdits.
- Discussion enfant : âge, humeur, type d'histoire, héros.
- Âge parent prioritaire : si l'enfant donne un autre âge, l'agent répond avec humour doux sans accusation.
- Ton babysitter : bienveillant, poli, éducatif léger.
- Synthèse vocale via Web Speech API.
- Interruption : le bouton "Répondre / interrompre" coupe la voix en cours et écoute ou lit la saisie manuelle.
- Garde-fous simples : transformation douce des demandes inadaptées.
- Résumé parent : scénario, thèmes, alertes.

## Limites MVP

- La reconnaissance vocale dépend du navigateur.
- Le LLM temps réel n'est pas branché : le prototype simule l'orchestration et les garde-fous côté client.
- Le hardware est volontairement hors scope à ce stade.
