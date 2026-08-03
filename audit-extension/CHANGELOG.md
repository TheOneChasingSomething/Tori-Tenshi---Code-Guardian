# Changelog

## [0.1.0] — Phase 1
### Ajouté
- Squelette d'extension VS Code (manifeste, activation, injection de dépendances).
- Couche Core : Types, Logger, EventBus typé, Result, Configuration (3 modes IA + exclusions).
- Persistance SQLite (better-sqlite3) : wrapper, migrateur, schéma initial, dépôts.
- Système de plugins : contrat AuditPlugin, PluginManager (routage, isolation des pannes).
- Plugins intégrés : Docker (règles DKR001–003), Ansible (ANS001–002), Packer (ébauche).
- UI : TreeViews Annotations / Graphe de confiance / Base de connaissances.
- Commandes : scan, annotation, changement d'état, export Obsidian, rafraîchissement.

### À venir
- Phases 2 à 7 (voir README).
