/**
 * Ce qu'une liste deroulante doit encore proposer apres une mise a la
 * corbeille (BUG-34, story 3.9 ; durci par la story 3.10).
 *
 * LE DEFAUT QUE CE MODULE FERME. Les listes des ecrans d'edition sont
 * baties par le client Prisma etendu, qui masque les lignes portant un
 * `deletedAt`. Le `defaultValue`, lui, continue de designer le parent
 * devenu invisible. Aucune `<option>` ne correspond alors : le navigateur
 * applique la regle du HTML et selectionne LA PREMIERE. Un agent qui ouvre
 * la fiche pour corriger un detail et clique « Enregistrer » repart avec
 * cette valeur, et le lien metier est reecrit sans un mot — ni a l'ecran,
 * ni au journal.
 *
 * Reproduit sur l'instance le 12 aout 2026 : une visite a change de bien.
 *
 * LE REMEDE. On garde le parent dans la liste, etiquete. C'est la seule des
 * trois issues envisagees qui ne perde ni l'information ni le geste :
 * refuser l'enregistrement bloquerait un agent sur une fiche qu'il ne peut
 * pas debloquer lui-meme (la corbeille est reservee a l'administrateur), et
 * empecher la mise a la corbeille d'un parent ayant des enfants vivants
 * annulerait a moitie ce que la story 4.6 a gagne — c'est justement pour
 * GARDER l'historique qu'on a cesse de detruire.
 *
 * L'option n'est deliberement PAS `disabled` : l'invariant a tenir est
 * « enregistrer sans rien changer ne change rien », et il ne doit dependre
 * d'aucune subtilite de soumission d'une option desactivee selon le
 * navigateur. Le libelle porte le signal, la correctitude passe avant lui.
 */

/** Ce qui est ajoute au libelle d'un parent mis a la corbeille. */
export const SUFFIXE_CORBEILLE = " — en corbeille"

/**
 * Le libelle d'une valeur courante que l'on ne sait pas relire :
 * identifiant d'une autre agence, derive de donnees. Voir
 * `optionsParent()`.
 */
export const LIBELLE_INTROUVABLE = "Référence introuvable — à corriger"

/**
 * Ce qu'une ligne doit porter pour etre proposee.
 *
 * `deletedAt` est REQUIS, et ce n'est pas un detail de typage : tant qu'il
 * etait optionnel, un ecran qui oubliait `deletedAt: true` dans son
 * `select` compilait, n'etiquetait rien, et proposait un parent supprime
 * sans le dire — la moitie de l'arbitrage de la story 3.9, perdue en
 * silence. Requis, l'oubli devient une erreur de compilation (REP-05).
 */
type Ligne = { id: string; deletedAt: Date | null }

/**
 * Le fragment de `where` qui ramene les vivants ET le parent courant, en
 * UNE SEULE requete (REP-03, REP-06, REP-07).
 *
 * CE QU'IL REMPLACE. La story 3.9 faisait deux requetes — les vivants, puis
 * l'archive — et les recollait en memoire. Trois consequences, relevees par
 * sa revue : un parent RESTAURE entre les deux n'etait dans aucune des deux
 * listes et le defaut d'origine revenait ; le parent archive etait recolle
 * EN TETE, ce qui cassait l'ordre annonce par l'`orderBy` et en faisait la
 * cible du repli du navigateur pour tout AUTRE decalage ; et la seconde
 * requete etait payee a chaque affichage, y compris quand le parent est
 * vivant — une a trois selon l'ecran.
 *
 * ⚠ LA FORME NATURELLE NE MARCHE PAS, et elle serait fausse en silence :
 *
 *     where: { agencyId, OR: [{ deletedAt: null }, { id: courant }] }
 *
 * L'extension de `lib/prisma.ts` teste `"deletedAt" in where` sur le
 * PREMIER NIVEAU seulement. Ici la clef est imbriquee dans le `OR` : elle
 * n'est pas vue, `deletedAt: null` est donc ajoute A COTE du `OR`, les deux
 * sont ET-es, et la branche qui devait ramener le parent en corbeille ne
 * ramene rien.
 *
 * D'ou la clef nommee explicitement avec `undefined` : Prisma n'en tire
 * aucune condition, mais elle rend la clef PRESENTE pour l'operateur `in`.
 * C'est l'idiome deja pose par la story 3.9 dans les Server Actions
 * (`deletedAt: lienInchange(…) ? undefined : null`) ; il n'est plus recopie
 * qu'ici.
 *
 * Ce fragment ne parle QUE de la corbeille : l'`agencyId` reste ecrit par
 * l'appelant, et la branche `{ id: courant }` lui est ET-ee — elle ne peut
 * donc pas ramener la ligne d'une autre agence.
 */
export function vivantsEtCourant(courant: string | null | undefined) {
  return {
    deletedAt: undefined,
    OR: courant ? [{ deletedAt: null }, { id: courant }] : [{ deletedAt: null }],
  }
}

/** Une `<option>`, une fois la ligne mise en forme. */
export type OptionParent = { value: string; label: string }

/**
 * Les options d'une liste deroulante, et la garantie que la valeur courante
 * en fait partie (REP-04).
 *
 * CE QUE LA STORY 3.9 N'AVAIT PAS FERME. Elle a traite UNE cause de
 * « `defaultValue` ne correspond a aucune option » : la corbeille. Les
 * autres restent — identifiant appartenant a une autre agence, derive de
 * donnees — et produisent le meme symptome, qui est le vrai defaut : le
 * navigateur choisit a la place de l'utilisateur, et personne ne le voit.
 *
 * On fabrique donc l'option manquante, etiquetee. Le formulaire repart
 * alors avec la valeur QU'IL AVAIT : la Server Action la reverifie contre
 * l'agence, ne la trouve pas, et REFUSE en le disant. Un lien anormal
 * devient visible et bloquant, au lieu d'etre reecrit ou efface en silence.
 *
 * Le libelle est fabrique par l'appelant (`title`, `firstName lastName`, …)
 * et le suffixe est ajoute ici : un suffixe recopie a dix endroits finit
 * par diverger a neuf.
 */
export function optionsParent<T extends Ligne>(
  lignes: T[],
  libelle: (ligne: T) => string,
  courant: string | null | undefined
): OptionParent[] {
  const options = lignes.map((ligne) => ({
    value: ligne.id,
    label: ligne.deletedAt
      ? `${libelle(ligne)}${SUFFIXE_CORBEILLE}`
      : libelle(ligne),
  }))

  if (courant && !options.some((option) => option.value === courant)) {
    return [{ value: courant, label: LIBELLE_INTROUVABLE }, ...options]
  }

  return options
}

/**
 * Un lien que l'on RESOUMET tel quel n'a pas a etre reverifie.
 *
 * CE QUI MANQUAIT, ET QUI RENDAIT LE CORRECTIF PIRE QUE LE DEFAUT. Rendre
 * le parent en corbeille dans la liste ne suffit pas : les Server Actions
 * reverifient le lien recu avec `findFirst({ where: { id, agencyId } })`,
 * un `where` qui ne nomme pas `deletedAt` — l'extension y injecte donc son
 * filtre, le parent en corbeille est introuvable, et l'enregistrement est
 * REFUSE. L'ecran devenait impossible a enregistrer, c'est-a-dire
 * exactement l'issue que la story 3.9 avait ecartee. Releve par la revue
 * du 12-08-2026, et mesure : `error=Bien ou client introuvable`.
 *
 * La regle posee ici est la plus etroite qui repare : un identifiant
 * INCHANGE est deja celui de la ligne, il a ete verifie au moment ou il y
 * a ete ecrit, et l'agence d'une ligne ne change pas. Le reverifier
 * n'apporte rien — et le reverifier avec le filtre de corbeille le
 * rejette.
 *
 * Un identifiant DIFFERENT, lui, reste verifie normalement : on ne peut
 * donc pas rattacher un enfant a un parent en corbeille qui n'etait pas
 * deja le sien.
 *
 * ⚠ Il ne dispense PAS du controle d'agence : `lienInchange` rend le
 * `deletedAt` facultatif, jamais l'`agencyId`. C'est ce qui fait qu'une
 * « reference introuvable » fabriquee par `optionsParent()` — un
 * identifiant hors agence — reste refusee.
 */
export function lienInchange(
  soumis: string | null | undefined,
  courant: string | null | undefined
): boolean {
  return Boolean(soumis) && soumis === courant
}
