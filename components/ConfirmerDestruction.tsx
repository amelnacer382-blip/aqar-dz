"use client"

import { useState } from "react"
import { Trash2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Faire confirmer une destruction irreversible (story 3.13, REP-106).
 *
 * ⚠ CE QUE CE COMPOSANT PROTEGE, ET CE QU'IL NE PROTEGE PAS.
 *
 * Il protege LE RENDU. C'est-a-dire le geste : un clic mal place dans un
 * tableau ou « Restaurer » et « Detruire » sont cote a cote. C'est le
 * defaut reel — un administrateur autorise, qui ne voulait pas.
 *
 * Il ne protege RIEN d'autre, et il ne le pretend pas. Une Server Action
 * est un point d'entree POST joignable sans l'ecran (CLAUDE.md §6, piege
 * 4) : ce dialogue ne s'y interpose pas. Un test le rejoue justement pour
 * le montrer, plutot que de laisser croire a une garde.
 *
 * ET C'EST LE BON PERIMETRE, pas un renoncement. La destruction est
 * AUTORISEE pour qui l'appelle : `requireAgencyAdmin()` a deja tranche.
 * Ajouter cote serveur un champ « confirmation » que le navigateur
 * enverrait toujours n'arreterait personne — ni l'accident, deja traite
 * ici, ni un administrateur decide, qui a le droit. Ce serait un garde-fou
 * en trompe-l'oeil, et ce depot en a deja paye un : « un avertissement
 * n'est pas un garde-fou » (story 3.5).
 *
 * POURQUOI `Dialog` ET NON `AlertDialog`. `@radix-ui/react-alert-dialog`
 * n'est pas installe, et l'ajouter serait une dependance de plus
 * (CLAUDE.md §2). `Dialog` est deja la, deja stylise, et rend exactement
 * le service attendu.
 *
 * POURQUOI LE BOUTON DE CONFIRMATION PORTE `form=`. Le contenu du dialogue
 * est deplace en fin de document par le portail de Radix : il n'est donc
 * plus DANS le formulaire. L'attribut `form` d'un bouton l'y rattache
 * quand meme — c'est du HTML, pas une astuce React, et cela evite de faire
 * traverser la Server Action jusqu'ici en tant que valeur.
 */
export function ConfirmerDestruction({
  formId,
  nature,
  intitule,
  detruit,
  detache,
}: {
  /** L'identifiant du `<form>` que ce dialogue soumet. */
  formId: string
  /** « bien », « client », « propriétaire ». */
  nature: string
  /** Le nom de la ligne visee, tel qu'il est affiché dans le tableau. */
  intitule: string
  /** Ce qui disparaît avec elle, déjà mis en phrase. */
  detruit: string
  /** Ce qui survit mais perd son rattachement. */
  detache: string
}) {
  const [ouvert, setOuvert] = useState(false)

  return (
    <>
      {/*
        `type="button"` EST OBLIGATOIRE. Un bouton sans type vaut `submit`
        a l'interieur d'un formulaire : il detruirait directement, et le
        dialogue s'ouvrirait sur une page deja partie.
      */}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOuvert(true)}
        className="text-red-600 hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 className="mr-1.5 h-4 w-4" />
        Détruire
      </Button>

      {/*
        §8 — CE QUE JE VIENS DE RENDRE INATTEIGNABLE. Le bouton ci-dessus
        etait un `submit` ; il est devenu un `button`, et le vrai envoi vit
        maintenant dans un dialogue pilote par JavaScript. Sans JavaScript,
        la corbeille deviendrait donc IMPOSSIBLE A VIDER — une capacite
        retiree en silence, au passage d'une story qui parlait d'autre
        chose.
        Ce depot traite le navigateur sans JavaScript comme un chemin reel :
        c'est celui qu'emprunte `tests/formulaire.ts` pour rejouer une
        Server Action. On le lui rend donc, sans confirmation possible — et
        en le disant, parce qu'un bouton qui detruit sans demander ne doit
        pas ressembler a celui qui demande.
      */}
      <noscript>
        <button
          type="submit"
          form={formId}
          className="text-sm text-red-700 underline"
        >
          Détruire sans confirmation (JavaScript désactivé)
        </button>
      </noscript>

      <Dialog open={ouvert} onOpenChange={setOuvert}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Détruire définitivement ce {nature} ?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2 text-left">
                <p className="font-medium text-dar-ink">{intitule}</p>

                {detruit ? (
                  <p>
                    Seront détruits avec lui : <strong>{detruit}</strong>.
                  </p>
                ) : (
                  <p>
                    Aucune autre donnée n&apos;en dépend : ce {nature} est
                    seul.
                  </p>
                )}

                {detache && (
                  <p>
                    Perdront leur rattachement, sans être supprimés :{" "}
                    <strong>{detache}</strong>.
                  </p>
                )}

                <p className="text-red-700">
                  Cette action est irréversible. Elle reste inscrite au
                  journal.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOuvert(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              form={formId}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Détruire définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
