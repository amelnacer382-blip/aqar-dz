import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { requireAgency } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { optionsParent, vivantsEtCourant, lienInchange } from "@/lib/corbeille"
import { saleSchema } from "@/lib/validations"
import { parseForm, withError, withSuccess } from "@/lib/form"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"

const saleStatuses = [
  { value: "negociation", label: "Négociation" },
  { value: "compromis", label: "Compromis" },
  { value: "vendu", label: "Vendu" },
  { value: "annule", label: "Annulé" },
]

export default async function EditSalePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const { id } = await params

  const sale = await prisma.sale.findFirst({
    where: { id, agencyId },
  })

  if (!sale) {
    notFound()
  }

  /**
   * Le parent mis a la corbeille reste dans la liste, etiquete (BUG-34).
   * Voir `lib/corbeille.ts` pour le defaut et l'arbitrage — et pour la
   * raison qui fait que ces deux listes tiennent en UNE requete chacune.
   */
  const [properties, clients] = await Promise.all([
    prisma.property.findMany({
      where: { agencyId, ...vivantsEtCourant(sale.propertyId) },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, deletedAt: true },
    }),
    prisma.client.findMany({
      where: { agencyId, ...vivantsEtCourant(sale.clientId) },
      orderBy: { createdAt: "desc" },
      select: { id: true, firstName: true, lastName: true, deletedAt: true },
    }),
  ])

  const biens = optionsParent(properties, (p) => p.title, sale.propertyId)
  const contacts = optionsParent(
    clients,
    (c) => `${c.firstName} ${c.lastName}`,
    sale.clientId
  )

  // Captures comme VALEURS : une Server Action ne capture pas un objet
  // retreci par un `notFound()` situe plus haut.
  const bienCourant = sale.propertyId
  const contactCourant = sale.clientId

  async function updateSale(formData: FormData) {
    "use server"

    const BACK = `/agency/sales/${id}/edit`
    const { agencyId } = await requireAgency()
    const parsed = parseForm(saleSchema, formData)

    if (!parsed.ok) {
      redirect(withError(BACK, parsed.message))
    }

    const data = parsed.data

    // Le bien et le client doivent appartenir a l'agence.
    // Un lien INCHANGE n'est pas reverifie : il l'a ete quand il a ete
    // ecrit, et le reverifier le rejetterait si le parent est passe a la
    // corbeille depuis (voir `lienInchange`).
    const [property, client] = await Promise.all([
      prisma.property.findFirst({
        where: {
          id: data.propertyId,
          agencyId,
          // Nommer la clef suffit a desactiver l'injection de
          // `lib/prisma.ts` ; `undefined` n'ajoute aucune condition. On
          // veut la ligne QUEL QUE SOIT son etat quand le lien est
          // inchange, et seulement vivante quand il change.
          deletedAt: lienInchange(data.propertyId, bienCourant)
            ? undefined
            : null,
        },
        select: { id: true, ownerId: true },
      }),
      prisma.client.findFirst({
        where: {
          id: data.clientId,
          agencyId,
          deletedAt: lienInchange(data.clientId, contactCourant)
            ? undefined
            : null,
        },
        select: { id: true },
      }),
    ])

    if (!property || !client) {
      redirect(withError(BACK, "Bien ou client introuvable"))
    }

    const updated = await prisma.sale.updateMany({
      where: { id, agencyId },
      data: {
        ...data,
        /*
          LE VENDEUR NE SE RECALCULE QUE SI LE BIEN CHANGE (REP-02).

          Cette ligne derivait le proprietaire du bien A CHAQUE
          enregistrement. Aucun formulaire ne rend ce champ : la valeur
          soumise etait donc toujours absente, et le vendeur suivait
          silencieusement le bien s'il avait change de mains depuis. C'est
          la famille de BUG-34, sur un lien calcule cote serveur — ce que
          l'inventaire bati par `grep name="..."` ne pouvait pas voir.

          `undefined` ne touche pas la colonne. Quand le bien change, en
          revanche, le vendeur DOIT suivre : la vente porte alors sur un
          autre bien, dont le proprietaire est quelqu'un d'autre.

          Le bien, lui, est verifie contre l'agence juste au-dessus : le
          proprietaire qui en decoule l'est donc aussi, par construction.
        */
        ownerId: lienInchange(data.propertyId, bienCourant)
          ? undefined
          : property.ownerId,
      },
    })

    if (updated.count === 0) {
      redirect(withError("/agency/sales", "Vente introuvable"))
    }

    revalidatePath(`/agency/sales/${id}`)
    redirect(withSuccess(`/agency/sales/${id}`, "Vente mise a jour"))
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href={`/agency/sales/${id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à la vente
              </Link>
            </Button>
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Modifier la vente</h1>
            <p className="text-slate-600 mt-1">
              Modifier les informations de la transaction
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Informations de la vente</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateSale} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="propertyId">Bien *</Label>
                    <Select name="propertyId" defaultValue={sale.propertyId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un bien" />
                      </SelectTrigger>
                      <SelectContent>
                        {biens.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="clientId">Client *</Label>
                    <Select name="clientId" defaultValue={sale.clientId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un client" />
                      </SelectTrigger>
                      <SelectContent>
                        {contacts.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="finalPrice">Prix final (DA) *</Label>
                    <Input
                      id="finalPrice"
                      name="finalPrice"
                      type="number"
                      defaultValue={Number(sale.finalPrice)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commission">Commission (DA)</Label>
                    <Input
                      id="commission"
                      name="commission"
                      type="number"
                      defaultValue={sale.commission ? Number(sale.commission) : ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="saleDate">Date de vente *</Label>
                    <Input
                      id="saleDate"
                      name="saleDate"
                      type="date"
                      defaultValue={new Date(sale.saleDate).toISOString().split("T")[0]}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Statut *</Label>
                    <Select name="status" defaultValue={sale.status} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un statut" />
                      </SelectTrigger>
                      <SelectContent>
                        {saleStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="submit" className="bg-dar-ink hover:bg-dar-blue">
                    Enregistrer les modifications
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/agency/sales/${id}`}>Annuler</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  )
}
