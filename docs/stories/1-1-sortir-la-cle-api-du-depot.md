---
baseline_commit: 43856d2
---

# Story 1.1: Sortir la clé d'API du dépôt

Status: in-progress

## Story

As a responsable du projet,
I want qu'aucun secret ne vive dans le dépôt ni dans son historique,
so that la fuite du dépôt ne donne accès à aucun service tiers.

**Couvre :** BUG-19 (défaut n° 03), REP-77

## L'arbitrage rendu, et ce qu'il change

**Rendu le 13-08-2026 par l'éditeur : Figma est abandonné. « On ne va plus
l'utiliser. »**

Cela simplifie la story et en durcit une partie. Les critères d'origine
prévoyaient de faire lire la clé depuis une variable d'environnement et de
documenter cette variable dans `.env.example`. **Ces deux critères
disparaissent** : on ne sécurise pas l'accès à un outil qu'on abandonne, on
le retire.

Ce qui ne disparaît pas, et c'est le cœur de la story :

> **Retirer Figma du dépôt ne révoque pas la clé.**

La clé reste un jeton valide chez Figma tant que personne ne la supprime de
ce côté-là. Elle est dans l'historique et le restera quoi qu'on fasse ici :

| Où | Vérifié le 13-08-2026 |
|---|---|
| `main`, commit `a529f61` | `git show a529f61:mcp-config.json` renvoie la clé en clair |
| `origin/feature/design-improvements` | `mcp-config.json` y est **encore suivi**, clé comprise, et la branche est **poussée sur GitHub** |

L'abandon rend la révocation **gratuite** : plus aucun usage n'en dépend,
donc plus aucune raison de la reporter. C'était la seule justification du
report du 10-08-2026 ; elle est tombée.

## Ce que cette story fait, et ce qu'elle ne peut pas faire

**Elle fait** — retirer Figma du dépôt comme outil vivant, et inscrire la
décision là où quelqu'un la retrouvera.

**Elle ne peut pas faire** — révoquer la clé. C'est un geste chez Figma,
hors du dépôt, et il appartient à l'éditeur. La story reste ouverte tant
qu'il n'est pas posé : la fermer avant reviendrait à cocher une case que
personne n'a faite (`CLAUDE.md` §8).

**Elle ne fait pas non plus** — réécrire l'historique. C'est une opération
qui republie de force `main` et impose de traiter aussi la branche
distante ; elle est hors de portée d'une décision prise en passant, et elle
devient **sans objet** une fois la clé révoquée : un jeton mort dans un
historique n'est plus un secret, c'est une trace. Le point reste ouvert et
tracé, comme les critères d'origine l'autorisent explicitement.

## Acceptance Criteria

1. **Given** Figma est abandonné — **When** la story est terminée — **Then**
   aucun fichier du dépôt ne configure ni ne documente Figma comme outil
   utilisable — **And** les mentions qui subsistent sont **historiques** et
   se lisent comme telles (registre des défauts, archives).

2. **Given** la clé `figd_…` est dans l'historique de `main` **et** suivie
   sur `origin/feature/design-improvements` — **When** la story est terminée
   — **Then** elle a été **révoquée chez Figma** — **And** la révocation est
   datée dans `action_items`, par la personne qui l'a faite.

3. **Given** la révocation est le seul remède réel — **When** on lit le
   dépôt — **Then** rien n'y laisse croire que retirer un fichier suffit :
   le registre et le suivi disent explicitement le contraire.

4. **Given** `mcp-config.json` pourrait revenir — **When** la story est
   terminée — **Then** `.gitignore` continue de l'ignorer, et son
   commentaire dit pourquoi sans renvoyer à un modèle qui n'existe plus.

5. **Given** la branche `origin/feature/design-improvements` porte le
   fichier — **When** la story est terminée — **Then** son sort est **tracé**
   — sa suppression ou sa conservation est une décision écrite, pas un
   oubli.

## Tasks / Subtasks

- [x] **1. Retirer Figma du dépôt** (AC 1, 4)
  - [x] Supprimer `mcp-config.example.json` — son unique serveur était Figma
  - [x] `.gitignore` — garder la règle, réécrire le commentaire
  - [x] Vérifier qu'aucune configuration vivante ne mentionne plus Figma
- [x] **2. Inscrire la décision** (AC 1, 3)
  - [x] `docs/qa/bug-report.md` — BUG-19 porte l'arbitrage et l'état réel
  - [x] `docs/stories/sprint-status.yaml` — `action_items` remis à jour
  - [x] `docs/epics.md` — les critères périmés remplacés
- [x] **3. Tracer la branche distante** (AC 5, REP-77)
  - [x] `REP-77` inscrit dans `deferred-work.md`
- [ ] **4. Révoquer la clé chez Figma** (AC 2) — **BLOQUÉ, geste éditeur**
  - [ ] Supprimer le jeton personnel dans les paramètres Figma
  - [ ] Dater la révocation dans `action_items`
- [ ] **5. Trancher le sort de `origin/feature/design-improvements`** (AC 5)
  - [ ] Décision de l'éditeur, puis exécution

## Dev Notes

### Ce qui a été mesuré, et comment

```bash
git grep -in "figma" -- .              # inventaire complet des mentions
git show a529f61:mcp-config.json       # la cle, en clair, dans main
git ls-tree -r --name-only origin/feature/design-improvements | grep mcp-config
git log --all --oneline -- mcp-config.json   # 2 commits
```

`git grep` du 13-08-2026 : hors de l'installation BMAD (`.claude/skills/`,
où « Figma » n'est qu'un exemple d'outil de maquettage sans rapport avec ce
dépôt), les mentions vivantes se réduisaient à `mcp-config.example.json` et
au commentaire de `.gitignore`. Tout le reste est **historique** —
`bug-report.md`, `epics.md`, `sprint-status.yaml`, `docs/README.md`, et
`GSD.md` qui est une archive.

`.env.example` ne mentionne pas Figma : le même `git grep` n'y a rien
trouvé, et il couvre ce fichier, qui est suivi.

### Pourquoi `.gitignore` garde sa règle

Le fichier `mcp-config.json` n'existe plus et n'a plus de modèle. La règle
qui l'ignore ne coûte rien et reste le filet si une configuration MCP
revient un jour, pour Figma ou pour autre chose. C'est le commentaire qui
devait changer : il renvoyait à `mcp-config.example.json`, supprimé.

### Ce que la revue devra regarder

Le piège de cette story est de **paraître finie**. Retirer un fichier est
visible et satisfaisant ; c'est aussi la partie qui ne protège de rien. La
seule question qui compte à la relecture est : *la clé a-t-elle été révoquée
chez Figma, et qui l'a fait ?* Tant que la réponse est non, la story est
`in-progress`, quel que soit l'état du dépôt.

### References

- [Source: docs/qa/bug-report.md#bug-19] — le constat d'origine et sa preuve
- [Source: docs/epics.md#Story-1.1] — les critères d'origine, avant l'abandon de Figma
- [Source: docs/stories/deferred-work.md] — `REP-77`, la branche distante

## Dev Agent Record

### Debug Log

**La clé est vivante à deux endroits, pas un.** Le report du 10-08-2026
ne connaissait que l'historique de `main`. La vérification du 13-08-2026,
demandée pour une tout autre raison — l'inventaire des branches — a montré
que `origin/feature/design-improvements` **suit encore** `mcp-config.json`,
clé comprise. Purger l'historique de `main` aurait donc laissé la clé
accessible, et aurait donné le sentiment inverse.

C'est la deuxième fois sur ce dépôt qu'un correctif partiel produit une
fausse assurance : sortir le fichier du suivi (`256d1a4`) avait déjà été
consigné comme « BUG-19 partiellement traité », ce qui était exact — mais
le registre n'a pas dit que la clé restait valide, et le report l'a rendue
invisible onze jours durant, exactement comme `REP-37`.

### Completion Notes

*(à compléter une fois la clé révoquée)*

Le dépôt ne configure plus Figma. `mcp-config.example.json` est supprimé —
son unique serveur était Figma, et le conserver vide n'aurait documenté que
l'absence. `.gitignore` garde la règle et perd le renvoi au modèle disparu.

**La clé n'est pas révoquée à cette date, et la story reste donc
`in-progress`.**

### File List

**Supprimés**
- `mcp-config.example.json` — unique serveur configuré : Figma

**Modifiés**
- `.gitignore` — commentaire de la règle `mcp-config.json`
- `docs/qa/bug-report.md` — BUG-19 : arbitrage, et les deux emplacements de la clé
- `docs/epics.md` — story 1.1, critères périmés remplacés
- `docs/stories/sprint-status.yaml` — statut, `action_items`
- `docs/stories/deferred-work.md` — `REP-77`
- `docs/stories/1-1-sortir-la-cle-api-du-depot.md` — ce fichier

### Change Log

- 13-08-2026 — story ouverte sur arbitrage de l'éditeur (**Figma
  abandonné**). Figma retiré du dépôt, décision inscrite, `REP-77` ouvert
  pour la branche distante. **Tâches 4 et 5 non faites, et écrites comme
  telles** : la révocation est un geste chez Figma, le sort de la branche
  une décision produit. La story reste `in-progress`.
