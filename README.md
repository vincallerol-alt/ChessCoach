# SauveParent

MVP React Native/Expo d'un compagnon vocal audio-first pour enfants.

## Lancer

```bash
npm install
npm run start
```

Puis ouvrir l'app avec Expo Go, un simulateur iOS/Android, ou le mode web.

## MVP inclus

- Configuration parent : age reel, prenom, duree, voix, themes, apprentissages, sujets interdits.
- Session enfant : l'agent demande l'age, l'humeur, le style d'histoire et le heros.
- Age parent prioritaire : si l'enfant donne un age incoherent, l'agent repond avec humour doux sans accusation.
- Agent babysitter : bienveillant, poli, legerement educatif.
- Audio-first : synthese vocale via `expo-speech`, bouton d'interruption, ecran enfant minimal.
- Garde-fous : sujets interdits, mots sensibles, transformation douce vers une idee acceptable.
- Resume parent : scenario, themes, alertes.

## Limite volontaire

Le STT et le LLM temps reel sont isoles derriere la logique de session mais pas encore branches. Cette version valide le parcours, le ton, les garde-fous et l'experience mobile avant d'ajouter une API vocale temps reel.
