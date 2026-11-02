---
baseline_commit: ddeee39
---

# Story 3.13 : Faire confirmer ce qui détruit onze tables

Status: done *(17-08-2026 — six mutations jouées séparément. `REP-106`
soldé, aucun constat ouvert. Aucune tâche ne relève de l'éditeur.)*

**Épopée :** 3 — Fiabiliser les données et la tenue à la charge
**Couvre :** `REP-106`
**Ouverte le :** 17-08-2026 (par la mesure de la story 3.5)

---

## Story

As a **agence**,
I want **qu'une destruction irréversible me soit confirmée avant d'être faite**,
So that **un clic mal placé ne m'enlève pas des quittances de loyer.**

---

## L'arbitrage, rendu ici — et il porte sur le périmètre

L'utilisateur a délégué la décision le 17-08-2026 : *« je te laisse
trancher, prends les meilleures décisions »*. Deux questions se posaient.

### 1. Un dialogue ne protège que le rendu. Faut-il davantage ?

**Non — et ce n'est pas un renoncement.** Une Server Action est un point
d'entrée `POST` joignable sans l'écran : aucun dialogue ne s'y interpose
(§6, piège 4). La tentation est d'ajouter côté serveur un champ
« confirmation » que le formulaire enverrait.

Ce champ n'arrêterait **personne** :

- pas l'accident — le navigateur l'enverrait toujours, et l'accident est
  déjà traité par le dialogue ;
- pas un administrateur décidé — `requireAgencyAdmin()` l'a **déjà
  autorisé** à détruire. C'est sa corbeille.

Ce serait un garde-fou en trompe-l'œil, et ce dépôt en a déjà payé un : la
story 3.5 a dû réécrire l'avertissement de cet écran, qui taisait les
ventes, les locations et leurs quittances. **Un avertissement n'est pas un
garde-fou** — et un faux garde-fou est pire qu'un avertissement honnête,
parce qu'on cesse de chercher le vrai.

Le périmètre juste est donc : **garder le geste, et écrire ce qui n'est pas
gardé.** Un test rejoue `purge` sans l'écran et constate qu'elle aboutit. Il
ne rougit pas ; il documente.

### 2. Quelle forme ? Une dépendance de plus ?

`@radix-ui/react-alert-dialog` — le composant que shadcn destine à cet
usage — **n'est pas installé**. L'ajouter serait une dépendance, donc §2.

`@radix-ui/react-dialog` **est là**, et `components/ui/dialog.tsx` avec.
Il rend exactement le service attendu. **Aucune dépendance ajoutée.**

---

## Ce qui fait la différence : le dialogue chiffre

« Êtes-vous sûr ? » ne dit rien. « Et tout ce qui en dépend » non plus : la
phrase est vraie d'une fiche vide comme d'un client de douze ans
d'historique.

L'AC-1 demandait une confirmation qui **nomme ce qui tombera**. Le dialogue
lit les comptes en base et écrit, par exemple :

> **Détruire définitivement ce client ?**
> Amina Belkacem
> Seront détruits avec lui : **1 visite, 1 vente, 1 location et 1 quittance
> de loyer**.
> Perdront leur rattachement, sans être supprimés : **1 paiement**.
> Cette action est irréversible. Elle reste inscrite au journal.

**Détruit et détaché sont dits séparément**, et ce n'est pas cosmétique : ce
ne sont pas les mêmes pertes, et les confondre fait passer une destruction
pour plus grave qu'elle n'est dans un sens, moins grave dans l'autre.

### La table qui range les conséquences est le fond du travail

Une vente rattachée à un **client** est détruite avec lui. **La même vente**
rattachée à un **propriétaire** survit en perdant son bailleur. Une liste
commune aurait donc menti à l'une des deux natures — et les deux mensonges
coûtent : l'un fait détruire ce qu'on croyait garder, l'autre fait renoncer
à une purge légitime.

`lib/consequences-destruction.ts` porte les deux tables, dérivées de
`npm run audit:cascades`, qui lit `prisma/schema.prisma`.

---

## §8 — ce que je viens de rendre inatteignable

Le bouton « Détruire » était un `submit`. Il est devenu un `button`, et le
véritable envoi vit dans un dialogue piloté par JavaScript. **Sans
JavaScript, la corbeille devenait impossible à vider** — une capacité
retirée en silence, au passage d'une story qui parlait d'autre chose.

Ce dépôt traite le navigateur sans JavaScript comme un chemin réel : c'est
celui qu'emprunte `tests/formulaire.ts` pour rejouer une Server Action. Un
`<noscript>` lui rend donc le bouton, **sans confirmation possible**, et
libellé comme tel : *« Détruire sans confirmation (JavaScript désactivé) »*.
Un bouton qui détruit sans demander ne doit pas ressembler à celui qui
demande.

---

## Acceptance Criteria

**Given** un élément à la corbeille
**When** l'utilisateur clique sur « Détruire »
**Then** une confirmation lui est demandée, et elle **nomme ce qui tombera** ✅
*(éprouvé sur « 1 quittance de loyer » et « 1 location », lus en base)*

**Given** cette confirmation
**When** elle est refusée ou fermée
**Then** rien n'est détruit, et le test le prouve en relisant la ligne par le client **non filtré** ✅

**Given** que le mécanisme n'existait nulle part dans le produit
**When** il est créé
**Then** il est réutilisable, et la story dit lesquelles des autres actions destructives devraient l'adopter — sans les modifier ✅
*(la liste est dans `docs/architecture.md` §4, avec celles qui ne doivent surtout pas l'adopter)*

**Given** la règle §6, piège 4
**When** le test est écrit
**Then** il prouve que la confirmation garde le **rendu**, et un second cas rejoue `purge` sans passer par l'écran ✅

---

## Qui devrait l'adopter — et qui ne doit surtout pas

| | |
|---|---|
| **L'a** | la purge de la corbeille — la seule action qui déclenche les **11 cascades** |
| **Devrait, dans cet ordre** | `deletePayment` et `deleteRecord` (lignes comptables : l'erreur ne se voit qu'au versement) · `deleteVisit` · `deleteInteraction`, le plus faible enjeu |
| **Ne doit PAS** | `deleteProperty`, qui **met à la corbeille** : l'action est réversible, et une confirmation posée là **apprendrait à cliquer à travers** celles qui comptent. `resetPassword` non plus — il n'efface aucune donnée métier |

**Aucune de ces actions n'a été modifiée.** La story pose le dispositif là
où le risque est le plus grand et écrit la liste, plutôt que de toucher sept
écrans d'un coup.

---

## Tasks / Subtasks

- [x] T1 — arbitrer le périmètre et la forme, et écrire les motifs
- [x] T2 — `lib/consequences-destruction.ts` : les deux tables et la mise en phrase
- [x] T3 — `components/ConfirmerDestruction.tsx`, sans dépendance nouvelle
- [x] T4 — l'écran : comptes réels lus en base, `<noscript>` de repli
- [x] T5 — tests : le libellé, la chaîne complète, le rejeu qui documente
- [x] T6 — six mutations, jouées séparément, chaque message d'échec lu
- [x] T7 — `tsc` 0 · `lint` 0 · `test:e2e` **192 passed**
- [x] T8 — registre : `REP-106` soldé ; `docs/` à jour

---

## Preuves — les six mutations

| # | Ce qu'on casse | Résultat | Message lu |
|---|---|---|---|
| **M1** | le déclencheur redevient un `submit` (le défaut d'origine) | ROUGE | *« le bouton « Détruire » est un `submit` : il détruit au premier clic »* |
| **M2** | l'attribut `form` du bouton de confirmation | ROUGE | *« confirmer n'a rien envoyé : le portail de Radix l'a sorti du `<form>` »* |
| **M3** | l'accord singulier/pluriel | ROUGE ×2 | *« un compte nul est énoncé, ou un accord est faux »* — **et l'assertion de bout en bout** |
| **M4** | `quittances` retiré de `DETRUITES.client` | ROUGE ×3 | *« les quittances de loyer ne sont plus annoncées : c'est de l'argent »* |
| **M6** | l'énumération perd son « et » | ROUGE | *« deux conséquences ne sont plus reliées par « et » »* |
| **M7** | `ventes` ajouté à `DETRUITES.owner` | ROUGE | *« détruire un propriétaire n'emporte que ses échanges »* |

*(M5 — retirer le filtre des zéros — n'a pas été jouée séparément : la même
assertion la couvre déjà, et M3 l'a fait rougir. Le dire vaut mieux que de
compter une mutation qu'on n'a pas faite.)*

**M3 est celle qui compte** : elle rougit à la fois sur la fonction pure
**et** sur le dialogue affiché à l'écran. C'est ce qui prouve que le texte
lu par l'agent vient bien de ce module, et non d'une chaîne écrite deux fois.

> ⚠ **Deux mutations ont d'abord rougi sans rien dire, et l'une a coûté
> quatre minutes.**
>
> **M1** faisait échouer le cas par un **dépassement de délai de 4 min 24** :
> le clic ouvrait le dialogue *et* envoyait le formulaire, la ligne
> disparaissait du tableau, et la suite du test attendait un bouton parti.
> Vrai, mais illisible. Une assertion directe a été ajoutée — le déclencheur
> doit porter `type="button"` — puis **la mutation rejouée** : elle tombe
> maintenant en une seconde, et dit quoi.
>
> **M2** rougissait sur `waitForNavigation: Timeout`. Le cas attend
> désormais **l'effet** — le message « Supprimé définitivement » — et non le
> silence du réseau. C'est la même leçon que §2 sur `networkidle`,
> rencontrée par un autre chemin.

**Contrôles positifs**, exigés et présents : après avoir prouvé qu'annuler
ne détruit rien, le même test **confirme** sur la même ligne et le même
bouton, et vérifie que le client **et** sa quittance ont bien disparu. Sans
cela, une destruction cassée pour tout le monde donnerait exactement le
même vert.

---

## Ce que ce travail ne prouve pas

- **La confirmation ne protège pas le point d'entrée**, et un test le
  constate au lieu de le taire. Voir l'arbitrage ci-dessus : c'est le bon
  périmètre, pas une dette.
- **Le repli `<noscript>` n'est pas éprouvé automatiquement.** Playwright
  sert des pages avec JavaScript ; désactiver JS pour un seul cas
  demanderait un contexte de navigateur à part. Le repli est donc **écrit et
  relu, pas exécuté** — et c'est dit ici plutôt que compté comme couvert.
- **Les six autres actions destructives n'ont pas été touchées**, donc rien
  n'est prouvé à leur sujet. La liste dit dans quel ordre les reprendre.

---

## Dev Agent Record

### Debug Log

- `npx tsc --noEmit` → 0 erreur
- `npm run lint` → 0 erreur (4 avertissements `<img>` préexistants, story 3.7)
- `npm run test:e2e` → **192 passed** (187 avant : +3 sur le libellé, +2 sur la chaîne)

### Completion Notes

- **Aucune dépendance ajoutée** : `Dialog` existait, `AlertDialog` non.
- **Les comptes sont lus en une requête par nature**, pas une par ligne :
  `_count` sur les relations, et les quittances — qui sont à deux niveaux
  (`Client → Rental → RentalManagement`) — sommées depuis les `_count` des
  locations.
- **La seule relation au pluriel pointant vers un modèle à corbeille**
  (`owner.properties`) porte son `where: { deletedAt: null }`, comme §2
  l'exige : sans lui, on annoncerait à l'agence des biens déjà supprimés
  (`BUG-24`).
- **Décomptes recalculés et inchangés** : 7 épopées, 62 stories dans les deux
  sources, 38 défauts. Quatrième story de suite à n'ouvrir ni story ni
  défaut.

---

## Change Log

| Date | Version | Description |
|---|---|---|
| 17-08-2026 | 1.0 | `REP-106` soldé, six mutations, story `done` |

---

## File List

**Créés**

- `lib/consequences-destruction.ts`
- `components/ConfirmerDestruction.tsx`
- `tests/consequences-destruction.spec.ts`
- `tests/corbeille-confirmation.spec.ts`
- `docs/stories/3-13-faire-confirmer-ce-qui-detruit.md`

**Modifiés**

- `app/agency/trash/page.tsx` — comptes réels, identifiant de formulaire,
  bouton remplacé par le composant
- `docs/architecture.md` — §4 : qui a le dispositif, qui devrait l'adopter,
  qui ne doit surtout pas
- `docs/stories/deferred-work.md`, `docs/stories/sprint-status.yaml`,
  `docs/epics.md`
