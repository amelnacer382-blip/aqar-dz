import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { History, Trash2, Plus } from "lucide-react"
import { formatDate, toDateInputValue } from "@/lib/format"
import { INTERACTION_TYPE_LABELS, INTERACTION_TYPE_COLORS, label } from "@/lib/labels"
import { createInteraction, deleteInteraction } from "@/app/agency/interactions/actions"
import { isAgencyAdmin } from "@/lib/auth-guard"

export type TimelineInteraction = {
  id: string
  type: string
  subject: string
  content: string | null
  date: Date
  authorId: string | null
}

/**
 * Historique des echanges avec un contact, avec formulaire d'ajout.
 *
 * Utilise aussi bien sur la fiche client que sur la fiche proprietaire :
 * `clientId` ou `ownerId` est fourni selon le contexte, jamais les deux.
 */
export function InteractionTimeline({
  interactions,
  clientId,
  ownerId,
  returnTo,
  userId,
  userRole,
}: {
  interactions: TimelineInteraction[]
  clientId?: string
  ownerId?: string
  returnTo: string
  userId: string
  userRole: string
}) {
  /**
   * Qui peut effacer quoi.
   *
   * Un agent efface les lignes qu'il a ecrites, un administrateur toutes.
   * La regle est celle de `deleteInteraction`, et elle y est REVERIFIEE :
   * ce bouton ne fait que cesser de proposer un geste qui sera refuse.
   */
  const peutSupprimer = (interaction: TimelineInteraction) =>
    isAgencyAdmin(userRole) || interaction.authorId === userId
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-slate-400" />
          Historique des interactions ({interactions.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Formulaire d'ajout */}
        <form action={createInteraction} className="space-y-4">
          {clientId && <input type="hidden" name="clientId" value={clientId} />}
          {ownerId && <input type="hidden" name="ownerId" value={ownerId} />}
          <input type="hidden" name="returnTo" value={returnTo} />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <select
                id="type"
                name="type"
                required
                defaultValue="appel"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                {Object.entries(INTERACTION_TYPE_LABELS).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={toDateInputValue(new Date())}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Objet *</Label>
              <Input
                id="subject"
                name="subject"
                placeholder="Ex : Relance après visite"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Compte rendu</Label>
            <Textarea
              id="content"
              name="content"
              rows={2}
              placeholder="Ce qui s'est dit, ce qui a été convenu..."
            />
          </div>

          <Button type="submit" size="sm" className="bg-slate-900 hover:bg-slate-800">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter à l&apos;historique
          </Button>
        </form>

        {/* Fil chronologique */}
        {interactions.length === 0 ? (
          <div className="text-center py-8 border-t border-slate-200">
            <History className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">
              Aucune interaction enregistrée pour l&apos;instant.
            </p>
          </div>
        ) : (
          <div className="border-t border-slate-200 pt-6">
            <ol className="relative border-l border-slate-200 ml-3">
              {interactions.map((interaction) => (
                <li key={interaction.id} className="mb-6 ml-6 last:mb-0">
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-slate-300 border-2 border-white" />
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge
                      variant="secondary"
                      className={INTERACTION_TYPE_COLORS[interaction.type] ?? ""}
                    >
                      {label(INTERACTION_TYPE_LABELS, interaction.type)}
                    </Badge>
                    <time className="text-xs text-slate-500">
                      {formatDate(interaction.date)}
                    </time>
                    {peutSupprimer(interaction) && (
                      <form action={deleteInteraction} className="ml-auto">
                        <input type="hidden" name="id" value={interaction.id} />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-slate-400 hover:text-red-600"
                          title="Supprimer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    )}
                  </div>
                  <h4 className="font-medium text-slate-900">{interaction.subject}</h4>
                  {interaction.content && (
                    <p className="text-sm text-slate-600 mt-1">{interaction.content}</p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
