# Architecture ChessCoach

## Vue d’ensemble

```mermaid
flowchart LR
    U["Vincent · mobile ou Windows"] --> PWA["PWA ChessCoach"]
    PWA --> SW["Service worker · cache hors ligne"]
    PWA --> IDB["IndexedDB · progression, séances et tentatives"]
    PWA --> SF["Stockfish 18 Lite/WASM · appareil"]
    PWA --> API["API Cloudflare Worker"]
    API --> D1["D1 · profil, progression, tentatives"]
    API --> CC["API publique Chess.com"]

    CODEX["Tâche Codex hebdomadaire"] --> JOB["coach:refresh"]
    JOB --> CC
    JOB --> SFCLI["Stockfish Lite/WASM · exécution locale"]
    SFCLI --> SNAP["Snapshot agrégé · programme 14 jours et exercices"]
    SNAP --> TEST["Tests"]
    TEST --> DEPLOY["Déploiement privé Sites/Cloudflare"]
    DEPLOY --> PWA
```

## Responsabilités

| Composant | Rôle | Impact |
|---|---|---|
| PWA | Échiquier, séance, installation | Expérience tactile et rapide |
| Stockfish Lite | Bot et analyse personnelle | Aucun coût de serveur d’échecs |
| IndexedDB | Cache local, progression et historique de séances | Utilisable sans réseau, sans fausse progression |
| Worker + D1 | Synchronisation et données durables | Continuité entre appareils |
| Codex planifié | Revue hebdomadaire des parties | Programme qui évolue sans sur-réagir |
| IA narrative | Explications du coach, plus tard | Budget indépendant et plafonnable |

## Flux d’entraînement

```mermaid
sequenceDiagram
    actor V as Vincent
    participant A as PWA
    participant S as Stockfish Lite
    participant D as IndexedDB/D1

    V->>A: Ouvre la séance du jour
    A->>D: Charge le programme et la progression réelle
    V->>A: Joue ou résout une position
    A->>S: Demande le meilleur coup localement
    S-->>A: Évaluation et variante
    A-->>V: Retour pédagogique
    A->>D: Enregistre la tentative
    D-->>A: Synchronisation immédiate ou différée
```

## Flux de maintenance

```mermaid
flowchart TD
    T["Lundi 07:00 · tâche Codex"] --> I["Importer les 50 dernières parties rapid/blitz"]
    I --> A["Analyser avec Stockfish Lite"]
    A --> G{"Au moins 5 parties ?"}
    G -- Non --> K["Conserver le focus actuel"]
    G -- Oui --> W["Recalculer les faiblesses pondérées"]
    K --> E["Créer 6 exercices et un programme de 14 jours"]
    W --> E
    E --> Q["Tests qualité et budget"]
    Q --> R{"Tests réussis ?"}
    R -- Non --> N["Rapport d’échec, aucun déploiement"]
    R -- Oui --> P["Publier la nouvelle version privée"]
    P --> M["Résumé dans la tâche Codex"]
```

## Évolutivité

`EngineAdapter` isole le moteur. Stockfish complet ou Maia pourront être ajoutés plus tard sans modifier le calcul de priorité, les exercices ni l’interface.
