import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { requireAgency } from "@/lib/auth-guard"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { optionsParent, vivantsEtCourant, lienInchange } from "@/lib/corbeille"
import { rentalSchema } from "@/lib/validations"
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

const rentalStatuses = [
  { value: "active", label: "Actif" },
  { value: "terminee", label: "Terminée" },
  { value: "annulee", label: "Annulée" },
]

export default async function EditRentalPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { agencyId, userRole, userName } = await requireAgency()
  const { id } = await params

  const rental = await prisma.rental.findFirst({
    where: { id, agencyId },
  })

  if (!rental) {
    notFound()
  }

  /**
   * Le parent mis a la corbeille reste dans la liste, etiquete (BUG-34).
   * Voir `lib/corbeille.ts` pour le defaut et l'arbitrage — et pour la
   * raison qui fait que ces deux listes tiennent en UNE requete chacune.
   */
  const [properties, clients] = await Promise.all([
    prisma.property.findMany({
      where: { agencyId, ...vivantsEtCourant(rental.propertyId) },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, deletedAt: true },
    }),
    prisma.client.findMany({
      where: { agencyId, ...vivantsEtCourant(rental.clientId) },
      orderBy: { createdAt: "desc" },
      select: { id: true, firstName: true, lastName: true, deletedAt: true },
    }),
  ])

  const biens = optionsParent(properties, (p) => p.title, rental.propertyId)
  const contacts = optionsParent(
    clients,
    (c) => `${c.firstName} ${c.lastName}`,
    rental.clientId
  )

  // Captures comme VALEURS : une Server Action ne capture pas un objet
  // retreci par un `notFound()` situe plus haut.
  const bienCourant = rental.propertyId
  const contactCourant = rental.clientId

  async function updateRental(formData: FormData) {
    "use server"

    const BACK = `/agency/rentals/${id}/edit`
    const { agencyId } = await requireAgency()
    const parsed = parseForm(rentalSchema, formData)

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

    const updated = await prisma.rental.updateMany({
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
      redirect(withError("/agency/rentals", "Location introuvable"))
    }

    revalidatePath(`/agency/rentals/${id}`)
    redirect(withSuccess(`/agency/rentals/${id}`, "Location mise a jour"))
  }

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href={`/agency/rentals/${id}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à la location
              </Link>
            </Button>
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Modifier la location</h1>
            <p className="text-slate-600 mt-1">
              Modifier les informations du bail
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Informations du bail</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateRental} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="propertyId">Bien *</Label>
                    <Select name="propertyId" defaultValue={rental.propertyId} required>
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
                    <Label htmlFor="clientId">Locataire *</Label>
                    <Select name="clientId" defaultValue={rental.clientId} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un locataire" />
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
                    <Label htmlFor="monthlyRent">Loyer mensuel (DA) *</Label>
                    <Input
                      id="monthlyRent"
                      name="monthlyRent"
                      type="number"
                      defaultValue={Number(rental.monthlyRent)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deposit">Caution (DA)</Label>
                    <Input
                      id="deposit"
                      name="deposit"
                      type="number"
                      defaultValue={rental.deposit ? Number(rental.deposit) : ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agencyFees">Frais d&apos;agence (DA)</Label>
                    <Input
                      id="agencyFees"
                      name="agencyFees"
                      type="number"
                      defaultValue={rental.agencyFees ? Number(rental.agencyFees) : ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startDate">Date de début *</Label>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      defaultValue={new Date(rental.startDate).toISOString().split("T")[0]}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate">Date de fin</Label>
                    <Input
                      id="endDate"
                      name="endDate"
                      type="date"
                      defaultValue={rental.endDate ? new Date(rental.endDate).toISOString().split("T")[0] : ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Statut *</Label>
                    <Select name="status" defaultValue={rental.status} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un statut" />
                      </SelectTrigger>
                      <SelectContent>
                        {rentalStatuses.map((status) => (
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
                    <Link href={`/agency/rentals/${id}`}>Annuler</Link>
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
