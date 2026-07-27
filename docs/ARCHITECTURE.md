# Architecture ChessCoach

## Vue d’ensemble

```mermaid
flowchart LR
    U["Vincent · mobile ou Windows"] --> PWA["PWA ChessCoach"]
    PWA --> SW["Service worker · cache hors ligne"]
    PWA --> IDB["IndexedDB · cache hors ligne"]
    PWA --> SF["Stockfish 18 Lite/WASM · appareil"]
    PWA --> API["API Cloudflare Worker"]
    API --> D1["D1 · parties, séances, exercices et tentatives"]
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
| IndexedDB | Cache local des données D1 | Utilisable sans réseau |
| Worker + D1 | Source durable des parties, séances, exercices et tentatives | Continuité entre appareils |
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

Une partie contre Stockfish terminée au mat, au temps ou par abandon est enregistrée avec son PGN, son résultat et sa cadence. Stockfish Lite analyse les coups du joueur sur l’appareil, conserve jusqu’à trois positions critiques et crée l’exercice prioritaire de la prochaine séance. IndexedDB reçoit immédiatement les données, puis D1 devient la source durable au retour du réseau.

Un exercice erroné reste verrouillé jusqu’au réessai. Le premier échec affiche le coup joué, le deuxième donne un principe, et le troisième révèle une comparaison avec une flèche vers le meilleur coup.

## Synchronisation multiappareil

```mermaid
sequenceDiagram
    participant M as Mobile
    participant I as IndexedDB
    participant W as Worker
    participant D as D1
    participant P as Autre appareil

    M->>I: Partie ou tentative hors ligne
    M->>W: Retour du réseau
    W->>D: Upsert des données utilisateur
    P->>W: Ouverture de ChessCoach
    W->>D: Lecture de l’état utilisateur
    W-->>P: Parties, séances, exercices, tentatives
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
