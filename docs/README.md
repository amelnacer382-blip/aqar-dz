# Documentation Aqar DZ

Analyse complète du 9 août 2026. **Règle d'or respectée : ces documents
ont été écrits avant toute modification de code.**

> **Mise à jour du 12 août 2026.** La phrase « aucun correctif n'a encore
> été appliqué » n'est plus vraie et a été retirée : treize stories sont
> `done`. L'état réel se lit dans
> [`stories/sprint-status.yaml`](stories/sprint-status.yaml), qui est la
> seule source de vérité de l'avancement — ce fichier-ci n'est qu'une porte
> d'entrée.

> **Correction du 9 août 2026.** Ce fichier annonçait une « analyse
> conduite selon la méthode BMAD ». C'était inexact : l'audit a été mené
> à la main, et BMAD n'était installé nulle part. La méthode réellement
> suivie jusque-là était **GSD** (règle 13, aujourd'hui `CLAUDE.md` §1).
>
> **BMAD 6.10.0 est désormais réellement installé** (modules BMM et TEA,
> agents en français, `_bmad/` et `.claude/skills/`), et **GSD est
> abandonné comme méthode** : `GSD.md` devient une archive des phases 1
> à 8. BMAD porte désormais tout le cycle de travail.

---

## Par où commencer

| Document | À lire quand |
|----------|--------------|
| [`../CLAUDE.md`](../CLAUDE.md) | **Avant tout.** Contrat de travail, règles permanentes, garde-fous. Chargé automatiquement par Claude Code |
| [`project-context.md`](project-context.md) | **Toujours en premier.** Règles du dépôt, pièges connus, définition de « terminé ». Chargé automatiquement par tous les agents BMAD |
| [`architecture.md`](architecture.md) | Vous reprenez le projet et voulez savoir comment il marche *réellement* |
| [`qa/bug-report.md`](qa/bug-report.md) | Vous voulez la liste des 35 défauts (BUG-01 à BUG-35), classés par gravité, avec les preuves et la table de correspondance n° d'audit ↔ BUG-xx |
| [`epics.md`](epics.md) | Vous voulez le plan de travail : 35 défauts + 3 risques d'exploitation découpés en 6 épopées et 48 stories |
| [`stories/sprint-status.yaml`](stories/sprint-status.yaml) | Vous voulez savoir où en est le sprint |
| [`stories/`](stories/) | Les 5 stories manuscrites d'origine — matière première, pas source de vérité |

### Qui dit quoi — et qui gagne

| Question | Fichier | Autorité |
|---|---|---|
| Comment travailler, règles, garde-fous | `CLAUDE.md` | **fait foi** après le code |
| Ce qu'est le produit, pour qui | `CONTEXT.md` | métier seulement |
| Comment le système marche vraiment | `docs/architecture.md` | descriptif |
| Où en est le projet | `stories/sprint-status.yaml` | **seule** source de vérité |
| Que reste-t-il à faire | `epics.md` | le plan |
| Les défauts | `qa/bug-report.md` (`BUG-nn`) | le registre |
| Les constats reportés | `stories/deferred-work.md` (`REP-nn`) | **chacun a une story** |
| Installer, déployer | `README.md` (racine) | opérationnel |
| `GSD.md` | **archive** | ne s'applique plus |

**En cas de contradiction : le code fait foi.** Ce dépôt est brownfield et sa
documentation a déjà divergé. Corriger la contradiction fait partie du
passage, ce n'est pas un travail à part.

---

## Travailler avec BMAD

```
bmad-sprint-status                 où en est-on
bmad-create-story                  fabriquer la prochaine story, contexte compris
bmad-dev-story                     l'implémenter
bmad-code-review                   la relire de façon adversariale
bmad-retrospective                 en fin d'épopée
```

Agents disponibles : **Mary** (analyste), **John** (PM), **Winston**
(architecte), **Sally** (UX), **Amelia** (développeuse), **Paige**
(rédaction technique), **Murat** (architecte de tests).
`bmad-help` répond quand on ne sait pas quoi lancer.

Pour une **nouvelle fonctionnalité**, commencer par `bmad-prd` : le
projet n'a pas de `docs/prd.md`, et `docs/epics.md` ne couvre que la
remise en état.

---

## Le plan de travail

Il vit dans [`epics.md`](epics.md) : **6 épopées, 48 stories**, issues de
l'audit de code (35 défauts) et du bilan de santé (sauvegarde, images,
couche métier). L'état d'avancement est dans
[`stories/sprint-status.yaml`](stories/sprint-status.yaml).

| Épopée | Bloque quoi |
|---|---|
| **0 — Ne pas perdre les données** | **tout. Seul risque irréversible** |
| 1 — Fermer ce qu'un tiers peut exploiter | l'ouverture à un premier client réel |
| 2 — Durcir le déploiement | la mise en ligne sur un VPS |
| 4 — Reprendre la suite de tests | rien, **mais à mener avant la 3** |
| 3 — Fiabiliser les données et la tenue à la charge | la montée en charge |
| 5 — Dette technique et lisibilité produit | rien |

Les cinq fichiers `stories/story-0X-*.md` sont les **specs manuscrites
d'origine**. Elles restent de la bonne matière première pour
`bmad-create-story`, mais elles ne couvrent que 18 défauts sur 34 : ce
n'est plus la source de vérité.

⚠️ Deux points n'appartiennent pas au développeur et bloquent leur story :
révoquer la clé Figma exposée (story 1.1), et trancher si un super admin
peut endosser une agence (story 5.1).

---

## Ce qui a été vérifié, et comment

- Lecture intégrale de `lib/`, des 12 routes API et des 31 Server Actions.
- Revue du schéma Prisma (20 tables, 18 énumérations) et des migrations.
- **Vérifications dynamiques sur l'instance Docker locale** : connexion,
  casse des emails, export CSV, dépôt et lecture de fichier, cloisonnement
  des routes protégées, sonde de santé, usurpation d'en-tête.
- **Mesures** : Lighthouse mobile, `EXPLAIN` sur les requêtes de liste,
  poids réellement transféré.

Les défauts marqués **[CONFIRMÉ]** ont été reproduits sur l'application en
fonctionnement, pas seulement déduits du code.

---

## Le résultat en une phrase

Le cloisonnement multi-locataire — la propriété la plus critique d'un SaaS
multi-agences — est correct et sans faille trouvée. Les 35 défauts relevés
sont des trous ponctuels dans un ouvrage solide.

**Ce qui reste avant d'ouvrir au public** — nommé plutôt que compté, un
décompte se périmant à chaque story : la clé d'API à révoquer chez Figma
(BUG-19, story 1.1) et — hors registre, mais c'est le seul risque
irréversible — **l'absence de toute sauvegarde** (épopée 0). Les cinq
suppressions directes des écrans d'édition (BUG-32) sont fermées depuis le
12 août par la story 4.6. L'état à jour se lit dans
[`stories/sprint-status.yaml`](stories/sprint-status.yaml).

> **Et ce que cinq passes ont fini par enseigner.** Les trois défauts
> trouvés le 12 août ne sont pas venus de la lecture d'un fichier de plus.
> Ils sont venus de questions posées à l'ensemble : *qui devrait porter
> cette garde, et ne la porte pas ?* (n° 32) ; *depuis quand ce que cette
> garde lit est-il vrai ?* (n° 33) ; *que devient ce qui pointait vers une
> ligne qu'on vient de masquer ?* (n° 34). Un audit fichier par fichier
> trouve les fautes ; il ne trouve pas les absences, parce qu'aucun fichier
> n'en est responsable. **Une passe part d'une propriété, pas d'un
> répertoire.**
>
> Le n° 34 ajoute une leçon que les deux autres n'avaient pas : il a été
> ouvert par une **correction**. La story 4.6 a eu raison de retirer la
> cascade qui détruisait l'historique d'un bien — et ce faisant, elle a
> rendu fréquent un état que rien ne traitait. **Une correction déplace le
> problème avant de le fermer ; c'est la revue qui doit demander où.**
