import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { recordAudit } from "@/lib/audit"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { FormMessage } from "@/components/FormMessage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Trash2, Undo2 } from "lucide-react"
import { formatDateTime } from "@/lib/format"
import { quotaBiens, refusDeQuota } from "@/lib/quotas"
import { ConfirmerDestruction } from "@/components/ConfirmerDestruction"
import {
  DETACHEES,
  DETRUITES,
  enumerer,
  lister,
  type Comptes,
} from "@/lib/consequences-destruction"

const BASE = "/agency/trash"

type Kind = "property" | "client" | "owner"

const KIND_LABELS: Record<Kind, string> = {
  property: "bien",
  client: "client",
  owner: "propriétaire",
}

/**
 * Verifie que la ligne visee est bien une ligne supprimee de cette agence.
 *
 * Definie au niveau du module, et non dans le composant : une action
 * serveur ne peut capturer que des valeurs, pas des fonctions. Declaree a
 * l'interieur, elle etait absente au moment de l'execution de l'action
 * (« locate is not defined »).
 */
async function locate(kind: string, id: string, agencyId: string) {
  const where = { id, agencyId, deletedAt: { not: null } }

  if (kind === "property") {
    return prisma.property.findFirst({ where, select: { id: true, title: true } })
  }

  if (kind === "client") {
    const found = await prisma.client.findFirst({
      where,
      select: { id: true, firstName: true, lastName: true },
    })
    return found
      ? { id: found.id, title: `${found.firstName} ${found.lastName}` }
      : null
  }

  if (kind === "owner") {
    const found = await prisma.owner.findFirst({
      where,
      select: { id: true, firstName: true, lastName: true },
    })
    return found
      ? { id: found.id, title: `${found.firstName} ${found.lastName}` }
      : null
  }

  return null
}

/**
 * Corbeille.
 *
 * Les suppressions de biens, clients et proprietaires ne detruisent plus la
 * ligne : elles la datent. Cet ecran est le seul endroit ou l'on peut soit
 * la ramener, soit la detruire pour de bon.
 *
 * La destruction definitive reste possible, parce qu'une agence doit
 * pouvoir purger de vraies erreurs de saisie — mais elle est explicite, et
 * elle est journalisee.
 */
export const metadata: Metadata = { title: "Corbeille" }

export default async function TrashPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgencyAdmin()
  const query = await searchParams

  const deleted = { not: null }

  /*
    LES COMPTES SONT LUS ICI, PAS ESTIMES (story 3.13, REP-106).

    « Et tout ce qui en depend » est vrai d'une fiche vide comme d'un client
    de douze ans d'historique : ce n'est pas une information, c'est une
    formule. Le dialogue de confirmation annonce des NOMBRES, et ils
    viennent de ces trois requetes.

    `_count` sur des relations AU PLURIEL — CLAUDE.md §2 exige la condition
    de corbeille quand la relation pointe vers un modele a corbeille. Une
    seule est dans ce cas : `owner.properties`. Les autres — visites,
    ventes, locations, quittances, paiements, echanges — ne portent pas de
    `deletedAt`, la condition n'aurait aucun sens.

    Les quittances sont a DEUX niveaux (Client/Property -> Rental ->
    RentalManagement) : `_count` ne descend pas si bas, on somme les
    `_count` des locations. Une requete quand meme, pas une par ligne.
  */
  const [properties, clients, owners] = await Promise.all([
    prisma.property.findMany({
      where: { agencyId, deletedAt: deleted },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        title: true,
        reference: true,
        deletedAt: true,
        _count: {
          select: {
            images: true,
            visits: true,
            sales: true,
            rentals: true,
            payments: true,
            leads: true,
          },
        },
        rentals: { select: { _count: { select: { rentalManagements: true } } } },
      },
    }),
    prisma.client.findMany({
      where: { agencyId, deletedAt: deleted },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        deletedAt: true,
        _count: {
          select: {
            visits: true,
            sales: true,
            rentals: true,
            interactions: true,
            payments: true,
          },
        },
        rentals: { select: { _count: { select: { rentalManagements: true } } } },
      },
    }),
    prisma.owner.findMany({
      where: { agencyId, deletedAt: deleted },
      orderBy: { deletedAt: "desc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        deletedAt: true,
        _count: {
          select: {
            interactions: true,
            sales: true,
            rentals: true,
            payments: true,
            // La SEULE relation au pluriel de cet ecran qui pointe vers un
            // modele a corbeille. Sans cette condition, on annoncerait a
            // l'agence des biens deja supprimes (BUG-24, story 3.5).
            properties: { where: { deletedAt: null } },
          },
        },
      },
    }),
  ])

  /** Les quittances d'une liste de locations, sommees. */
  const quittances = (
    locations: Array<{ _count: { rentalManagements: number } }>
  ) => locations.reduce((total, l) => total + l._count.rentalManagements, 0)

  const rows = [
    ...properties.map((p) => ({
      kind: "property" as Kind,
      id: p.id,
      label: p.title,
      detail: p.reference,
      deletedAt: p.deletedAt,
      comptes: {
        photos: p._count.images,
        visites: p._count.visits,
        ventes: p._count.sales,
        locations: p._count.rentals,
        quittances: quittances(p.rentals),
        paiements: p._count.payments,
        demandes: p._count.leads,
      } satisfies Comptes,
    })),
    ...clients.map((c) => ({
      kind: "client" as Kind,
      id: c.id,
      label: `${c.firstName} ${c.lastName}`,
      detail: null,
      deletedAt: c.deletedAt,
      comptes: {
        visites: c._count.visits,
        ventes: c._count.sales,
        locations: c._count.rentals,
        quittances: quittances(c.rentals),
        echanges: c._count.interactions,
        paiements: c._count.payments,
      } satisfies Comptes,
    })),
    ...owners.map((o) => ({
      kind: "owner" as Kind,
      id: o.id,
      label: `${o.firstName} ${o.lastName}`,
      detail: null,
      deletedAt: o.deletedAt,
      // Un proprietaire ne DETRUIT ni ventes ni locations : elles survivent
      // en perdant leur bailleur. C'est `DETACHEES.owner` qui les range du
      // bon cote — les compter ici sans les additionner a autre chose est
      // ce qui permet de le dire juste.
      comptes: {
        echanges: o._count.interactions,
        biens: o._count.properties,
        ventes: o._count.sales,
        locations: o._count.rentals,
        paiements: o._count.payments,
      } satisfies Comptes,
    })),
  ].sort(
    (a, b) => (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0)
  )

  async function restore(formData: FormData) {
    "use server"
    const { agencyId, userId, userName } = await requireAgencyAdmin()

    const kind = String(formData.get("kind") ?? "")
    const id = String(formData.get("id") ?? "")

    const found = await locate(kind, id, agencyId)

    if (!found) {
      redirect(`${BASE}?error=${encodeURIComponent("Élément introuvable")}`)
    }

    /*
      RESTAURER FAIT REMONTER LE DECOMPTE SANS RIEN CREER (FR-11).

      C'est le chemin qui rendrait le plafond des biens contournable en
      trois gestes : supprimer, creer, restaurer. Il ne comptait pour rien
      tant que rien ne comptait — poser un plafond vient de le rendre
      atteignable (CLAUDE.md §8).

      SEULS LES BIENS SONT PLAFONNES. Restaurer un client ou un
      proprietaire n'est soumis a rien, et ne doit surtout pas l'etre : les
      plafonder au passage serait inventer une regle que personne n'a
      vendue.

      Le bien restaure n'est pas encore dans le decompte — il porte un
      `deletedAt`, que `count()` exclut. Le refus se lit donc bien « il n'y
      a plus de place pour un de plus ».
    */
    if (kind === "property") {
      const quota = await quotaBiens(agencyId)

      if (quota.atteint) {
        redirect(
          `${BASE}?error=${encodeURIComponent(refusDeQuota(quota, "bien"))}`
        )
      }
    }

    const data = { deletedAt: null }

    if (kind === "property") await prisma.property.update({ where: { id }, data })
    else if (kind === "client") await prisma.client.update({ where: { id }, data })
    else await prisma.owner.update({ where: { id }, data })

    await recordAudit({
      agencyId,
      userId,
      userName,
      action: "restauration",
      entity: KIND_LABELS[kind as Kind],
      entityId: id,
      summary: `${found.title} restauré depuis la corbeille`,
    })

    revalidatePath(BASE)
    redirect(`${BASE}?success=${encodeURIComponent("Élément restauré")}`)
  }

  async function purge(formData: FormData) {
    "use server"
    const { agencyId, userId, userName } = await requireAgencyAdmin()

    const kind = String(formData.get("kind") ?? "")
    const id = String(formData.get("id") ?? "")

    const found = await locate(kind, id, agencyId)

    if (!found) {
      redirect(`${BASE}?error=${encodeURIComponent("Élément introuvable")}`)
    }

    // Journaliser AVANT de detruire : apres, il ne reste rien a decrire.
    await recordAudit({
      agencyId,
      userId,
      userName,
      action: "suppression",
      entity: KIND_LABELS[kind as Kind],
      entityId: id,
      summary: `${found.title} supprimé définitivement`,
    })

    /*
      LES TROIS SEULS `delete()` AUTORISES DU PRODUIT.

      La regle ESLint `no-restricted-syntax` de `.eslintrc.json` refuse
      `delete()` et `deleteMany()` sur ces trois modeles partout ailleurs
      (story 3.5, REP-99). L'exception est levee ICI, ligne par ligne, et
      pas au niveau du fichier : le jour ou une sixieme suppression
      s'ajoutera dans ce fichier, elle devra etre justifiee elle aussi.

      Elle est legitime parce que c'est le seul endroit ou detruire EST la
      demande : la corbeille doit pouvoir se vider. L'appelant est un
      administrateur d'agence (`requireAgencyAdmin`), l'element est deja a
      la corbeille, et le journal a ete ecrit juste au-dessus.

      Ce que cela emporte est recense : `npm run audit:cascades`.
    */
    // eslint-disable-next-line no-restricted-syntax -- vidage de la corbeille, seul usage legitime
    if (kind === "property") await prisma.property.delete({ where: { id } })
    // eslint-disable-next-line no-restricted-syntax -- idem
    else if (kind === "client") await prisma.client.delete({ where: { id } })
    // eslint-disable-next-line no-restricted-syntax -- idem
    else await prisma.owner.delete({ where: { id } })

    revalidatePath(BASE)
    redirect(`${BASE}?success=${encodeURIComponent("Supprimé définitivement")}`)
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash min-h-screen pt-16">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">
              Corbeille
            </h1>
            <p className="mt-1 text-slate-600">
              Les biens, clients et propriétaires supprimés restent ici tant
              que vous ne les détruisez pas.
            </p>
          </div>

          <FormMessage error={query.error} success={query.success} />

          <Card>
            <CardHeader>
              <CardTitle>
                {rows.length} élément{rows.length > 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <div className="py-16 text-center">
                  <Trash2 className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                  <p className="font-medium text-dar-ink">Corbeille vide</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Rien n&apos;a été supprimé.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Élément</TableHead>
                        <TableHead>Nature</TableHead>
                        <TableHead>Supprimé le</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={`${row.kind}-${row.id}`}>
                          <TableCell>
                            <p className="font-medium text-dar-ink">{row.label}</p>
                            {row.detail && (
                              <p className="font-mono text-xs text-slate-500">
                                {row.detail}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="capitalize text-slate-600">
                            {KIND_LABELS[row.kind]}
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs text-slate-500">
                            {formatDateTime(row.deletedAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <form action={restore}>
                                <input type="hidden" name="kind" value={row.kind} />
                                <input type="hidden" name="id" value={row.id} />
                                <Button
                                  type="submit"
                                  size="sm"
                                  variant="ghost"
                                  className="text-dar-blue hover:bg-dar-blue-soft"
                                >
                                  <Undo2 className="mr-1.5 h-4 w-4" />
                                  Restaurer
                                </Button>
                              </form>

                              {/*
                                L'identifiant du formulaire est ce qui
                                rattache le bouton du dialogue, deplace en
                                fin de document par le portail de Radix.
                                Il porte la nature ET l'identifiant : deux
                                lignes du tableau ne doivent jamais partager
                                le meme, sans quoi la confirmation de l'une
                                detruirait l'autre.
                              */}
                              <form
                                action={purge}
                                id={`detruire-${row.kind}-${row.id}`}
                              >
                                <input type="hidden" name="kind" value={row.kind} />
                                <input type="hidden" name="id" value={row.id} />
                                <ConfirmerDestruction
                                  formId={`detruire-${row.kind}-${row.id}`}
                                  nature={KIND_LABELS[row.kind]}
                                  intitule={row.label}
                                  detruit={enumerer(
                                    lister(DETRUITES[row.kind], row.comptes)
                                  )}
                                  detache={enumerer(
                                    lister(DETACHEES[row.kind], row.comptes)
                                  )}
                                />
                              </form>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/*
                    CETTE PHRASE A ETE CORRIGEE PAR CE QU'ELLE DECRIT
                    (story 3.5). Elle annoncait « photos, visites,
                    historique » — trois consequences anodines. L'inventaire
                    des cascades, `npm run audit:cascades`, en a nomme onze,
                    dont les ventes, les locations et leurs quittances : de
                    l'argent. Une agence ne peut pas consentir a ce qu'on ne
                    lui dit pas.
                  */}
                  <p className="mt-5 text-xs leading-relaxed text-slate-500">
                    « Détruire » efface la ligne <strong>et tout ce qui en
                    dépend</strong> : photos, visites, ventes, locations et
                    leurs quittances, historique des échanges. Les paiements
                    sont conservés, mais perdent leur rattachement. Cette
                    action est irréversible et reste inscrite au journal.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
