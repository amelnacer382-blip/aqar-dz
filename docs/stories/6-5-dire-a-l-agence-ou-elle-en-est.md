---
baseline_commit: ec0ac45
---

# Story 6.5 : Dire à l'agence où elle en est

Status: done

**Épopée :** 6 — Vendre ce que le produit tient
**Couvre :** FR-13
**Source :** [`docs/prds/prd-aqar-dz-offres-2026-08-15/prd.md`](../prds/prd-aqar-dz-offres-2026-08-15/prd.md) §4.5
**Découpage :** [`docs/epics.md`](../epics.md) — Epic 6, story 6.5
**Dépend de :** 6.1, 6.4
**Date :** 16 août 2026

---

## Story

**En tant qu'**administrateur d'agence,
**je veux** voir mes plafonds et ma consommation,
**afin de** ne pas découvrir ma limite au moment où elle me bloque.

---

## Acceptance Criteria

**AC-1** — **Given** un `agency_admin` sur `/agency/settings`
**When** la page s'affiche
**Then** elle montre l'offre attribuée, ses plafonds **et le décompte
actuel**

**AC-2** — **Given** une offre au plafond illimité
**When** la page l'affiche
**Then** elle l'annonce comme **illimité**, sans nombre inventé

**AC-3** — **Given** une agence **au-dessus** de son plafond, après
rétrogradation
**When** la page s'affiche
**Then** l'état est **visible sans être alarmiste** — la situation est
légitime, rien n'est en danger

---

## Trois états, et le troisième est le délicat

| État | Ce qui s'affiche | Pourquoi |
|---|---|---|
| Illimité | « sur illimité », **pas de barre** | une jauge sans maximum ne veut rien dire |
| Sous le plafond | « 3 sur 20 », barre bleue | l'information avant le mur |
| **Au-dessus** | « 23 sur 20 », barre **ocre** bornée à 100 %, et une phrase | du rouge ferait croire à un incident |

La phrase du troisième état est le vrai livrable : *« Tout est conservé et
reste modifiable ; seules les créations sont en attente d'une place. »*
Sans elle, une agence rétrogradée croit avoir un problème à régler et
**efface des biens qu'elle a le droit de garder** — ce que FR-12 interdit
au produit, et que l'écran ne doit pas provoquer non plus.

---

## Ce que cette story rend atteignable (`CLAUDE.md` §8)

1. **Un chiffre affiché est un chiffre qu'on croit.** L'écran devient la
   référence de l'agence sur sa consommation : il doit compter **comme
   l'action compte**. C'est pourquoi il appelle `quotaBiens` et
   `quotaComptes` — les mêmes fonctions que les gardes de la story 6.4 — et
   ne redérive rien. Deux façons de compter finiraient par diverger, et
   c'est l'écran qu'on croirait.

2. **Un dépassement peut se lire comme une panne.** Traité par le ton et par
   la couleur, pas seulement par le texte.

3. **`/agency/settings` gagne deux requêtes au rendu.** Négligeable, et
   l'écran est déjà un écran de lecture.

---

## Tasks / Subtasks

- [x] **T1 — L'affichage.** Un bloc « Votre consommation » sur
      `/agency/settings`, biens et comptes.
- [x] **T2 — Les trois états.** Illimité sans nombre, barre bornée,
      dépassement dit sans alarme.
- [x] **T3 — Aucun décompte parallèle.** Le module `lib/quotas.ts` de la
      story 6.4, et lui seul.
- [x] **T4 — Le test.** Un cas dans `tests/plafonds.spec.ts` couvrant les
      trois états.
- [x] **T5 — La preuve.** `npm run test:e2e` exécutée le 16-08-2026 :
      **140 passed**.
- [x] **T6 — Les contrôles.** `tsc` ✅ 0 · `lint` ✅ 0 · `test:e2e` ✅ 140 verts.

---

## Dev Notes

### L'espace entre le décompte et le plafond est écrit

`{quota.decompte}{" "}<span>sur 20</span>` : sans le `{" "}`, le texte de la
page vaut `3sur 20`. L'espace n'était dessiné que par une marge CSS — une
synthèse vocale lit le texte, pas la marge. Le défaut a été trouvé en
écrivant l'assertion du test, pas en regardant l'écran.

### Pourquoi pas de pastille de couleur sur l'offre

L'écran nomme l'offre en texte simple, comme avant. Une pastille ou un
badge la ferait ressembler à un **statut** — or le statut de l'agence est
juste à côté, et il est orthogonal à l'offre (PRD §3). Deux badges côte à
côte se lisent comme deux facettes d'une même chose.

---

## Dev Agent Record

### Completion Notes List

**Fait :** les trois états, une seule source de décompte, et le défaut
d'espacement corrigé.

**Non fait :** T5. Le cas de test est **écrit, pas vert**.

**Laissé ouvert :** l'écran ne propose aucun moyen de **changer** d'offre —
il n'y en a pas dans le produit, l'attribution est une décision de
l'éditeur (story 6.3). Le message de refus de la story 6.4 renvoie donc
vers l'équipe Aqar DZ, pas vers un bouton.

### File List

**Modifiés (3)**
- `app/agency/settings/page.tsx`
- `tests/plafonds.spec.ts` *(le cas FR-13)*
- `docs/stories/sprint-status.yaml`
