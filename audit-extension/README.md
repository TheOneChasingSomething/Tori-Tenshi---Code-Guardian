# Audit Extension

Extension VS Code de **revue de code assistée et d'audit de sécurité**, à
architecture orientée plugins. Chaque technologie (Ansible, Docker, Packer,
Python, JavaScript, C, C++, HTML…) est analysée par un plugin indépendant :
le cœur ne contient jamais de logique d'analyse spécifique à un langage.

> État : **Phase 1** du cahier des charges — architecture, système de plugins,
> persistance SQLite, TreeViews et commandes. Les phases 2 à 7 (Obsidian,
> analyseurs Tree-sitter, graphe interactif, analyse dynamique, connecteurs IA,
> rapports) restent à implémenter.

## Architecture

```
src/
├── extension.ts          Point d'entrée : activation + injection de dépendances
├── core/                 Types, Logger, EventBus, Result, Configuration
├── models/               Entités du domaine (Annotation, TrustNode/Edge, KnowledgeNote)
├── persistence/          Base SQLite, migrateur, dépôts (repositories)
│   ├── Database.ts
│   ├── migrations/
│   └── repositories/
├── plugins/              Contrat AuditPlugin + PluginManager
│   └── builtin/          Docker (fonctionnel), Ansible, Packer (ébauches)
├── ui/                   Fournisseurs de TreeView (annotations, confiance, savoir)
└── commands/             Enregistrement des commandes VS Code
```

Le découpage suit une logique d'architecture hexagonale : `core/` et `models/`
n'ont **aucune** dépendance vers l'API VS Code et sont testables en isolation.
La communication entre couches passe par un `EventBus` typé, ce qui évite les
couplages directs et facilite l'ajout de plugins [1].

### Confidentialité (trois modes IA)

Conformément au cahier des charges, le paramètre `audit.llm.mode` propose :

| Mode           | Comportement                                                        |
| -------------- | ------------------------------------------------------------------- |
| `local`        | Défaut. Aucun code ne quitte la machine (LSP/Tree-sitter/linters).  |
| `llm-local`    | Modèle local (Ollama, LM Studio, vLLM). Aucune transmission Internet.|
| `remote-agent` | Agent distant (Windsurf). **Désactivé** tant que `audit.remoteAgent.enabled` n'est pas explicitement activé. |

Les motifs de `audit.exclusionGlobs` (par défaut `*.pem`, `secrets.yml`,
`inventory`, `.env`) ne sont jamais transmis à un service externe
(`Configuration.isTransmittable`).

## Installation et exécution

Prérequis : Node.js ≥ 18, VS Code ≥ 1.90.

```bash
npm install          # installe better-sqlite3 et les types
npm run compile      # tsc -> out/
# Puis, dans VS Code : F5 (« Run Extension ») pour lancer une fenêtre de test.
```

> Remarque : `better-sqlite3` est un module natif recompilé à l'installation.
> Ce dépôt a été **vérifié en types hors ligne** (`.typecheck/`, modules
> externes stubés) mais non compilé avec ses dépendances réelles.

## Commandes

| Commande                  | Effet                                              |
| ------------------------- | -------------------------------------------------- |
| `audit.scanWorkspace`     | Analyse l'espace de travail via les plugins.       |
| `audit.addAnnotation`     | Annote la sélection courante (versionnée).         |
| `audit.setNodeState`      | Change l'état d'un nœud de confiance.              |
| `audit.exportObsidian`    | `Ctrl+Shift+O` — crée une note (coffre : Phase 2). |
| `audit.refreshViews`      | Rafraîchit les vues.                               |

## Feuille de route

1. ✅ Architecture, plugins, SQLite, TreeViews, persistance.
2. ⬜ Annotations avancées, base de connaissances, intégration Obsidian native.
3. ⬜ Analyseurs Ansible/Docker/Packer/Python/JS/C/C++/HTML (LSP + Tree-sitter).
4. ⬜ Moteur de graphes + visualisation interactive (WebView).
5. ⬜ Analyse dynamique (Ansible, Docker, QEMU) + linters.
6. ⬜ Connecteurs IA (local par défaut, Windsurf sur autorisation).
7. ⬜ Rapports d'audit Markdown/HTML/PDF + tableau de bord.

## Références

1. Martin, R. C. *Clean Architecture: A Craftsman's Guide to Software Structure and Design*. Prentice Hall, 2017.
2. Visual Studio Code. *Extension API*. https://code.visualstudio.com/api
3. Tree-sitter. *Incremental Parsing System*. https://tree-sitter.github.io/tree-sitter/
4. SQLite. *The SQLite Database File Format* & *Documentation*. https://sqlite.org/docs.html
5. Microsoft. *Language Server Protocol Specification*. https://microsoft.github.io/language-server-protocol/

## Annexe — Acronymes

- **API** — *Application Programming Interface* : interface de programmation.
- **HCL** — *HashiCorp Configuration Language* : langage de configuration de Packer/Terraform.
- **HTML** — *HyperText Markup Language* : langage de balisage des pages Web.
- **LLM** — *Large Language Model* : modèle de langage de grande taille.
- **LSP** — *Language Server Protocol* : protocole d'analyse de code côté éditeur.
- **PDF** — *Portable Document Format* : format de document à mise en page préservée.
- **QEMU** — *Quick Emulator* : émulateur/hyperviseur de machines virtuelles.
- **SQL** — *Structured Query Language* : langage de manipulation de bases relationnelles.
- **WAL** — *Write-Ahead Logging* : mode de journalisation de SQLite.
- **YAML** — *YAML Ain't Markup Language* : format de sérialisation lisible.
