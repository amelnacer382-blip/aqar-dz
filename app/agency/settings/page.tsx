import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { requireAgencyAdmin } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { AgencyNavbar } from "@/components/layout/AgencyNavbar"
import { FormMessage } from "@/components/FormMessage"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ImageUploadField } from "@/components/upload/ImageUploadField"
import { ExternalLink, Globe, Store } from "lucide-react"
import { slugify } from "@/lib/format"
import { AGENCY_STATUS_LABELS, AGENCY_STATUS_COLORS, label } from "@/lib/labels"
import { agencySettingsSchema } from "@/lib/validations"
import { parseForm, withError, withSuccess } from "@/lib/form"
import { nomOffre, formaterPlafond, offre } from "@/lib/offres"
import { getPaymentDetails, buildPaymentWhatsAppUrl } from "@/lib/payment"
import { PaymentInstructionsCard } from "@/components/agency/PaymentInstructionsCard"
import { quotaBiens, quotaComptes, type Quota } from "@/lib/quotas"

const BASE = "/agency/settings"

export const metadata: Metadata = { title: "Paramètres" }

export default async function AgencySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { agency, userRole, userName } = await requireAgencyAdmin()

  const [biens, comptes] = await Promise.all([
    quotaBiens(agency.id),
    quotaComptes(agency.id),
  ])
  const paymentDetails = getPaymentDetails()
  const whatsappUrl = buildPaymentWhatsAppUrl({
    agencyName: agency.name,
    planName: nomOffre(agency.plan),
    amount: offre(agency.plan).prix,
  })
  const params = await searchParams

  async function updateSettings(formData: FormData) {
    "use server"
    const { agencyId } = await requireAgencyAdmin()

    const parsed = parseForm(agencySettingsSchema, formData)

    if (!parsed.ok) {
      redirect(withError(BASE, parsed.message))
    }

    const data = parsed.data

    // Le slug construit l'URL publique : il doit rester unique entre agences.
    if (data.slug) {
      const taken = await prisma.agency.findFirst({
        where: { slug: data.slug, id: { not: agencyId } },
        select: { id: true },
      })

      if (taken) {
        redirect(
          withError(BASE, "Cet identifiant de vitrine est déjà utilisé par une autre agence")
        )
      }
    }

    await prisma.agency.update({
      where: { id: agencyId },
      data: {
        name: data.name,
        phone: data.phone,
        address: data.address,
        wilaya: data.wilaya,
        commune: data.commune,
        slug: data.slug,
        description: data.description,
        showcaseEnabled: data.showcaseEnabled,
        logo: data.logo,
      },
    })

    revalidatePath(BASE)
    redirect(withSuccess(BASE, "Paramètres enregistrés"))
  }

  const suggestedSlug = agency.slug ?? slugify(agency.name)
  const publicUrl = agency.slug ? `/vitrine/${agency.slug}` : null

  return (
    <>
      <AgencyNavbar role={userRole} userName={userName} />
      <main className="limewash pt-16 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-dar-ink">Paramètres de l&apos;agence</h1>
            <p className="text-slate-600 mt-1">
              Coordonnées, identité et configuration de votre vitrine publique
            </p>
          </div>

          <FormMessage error={params.error} success={params.success} />

          {/* Statut d'abonnement, en lecture seule */}
          <Card className="mb-6">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div>
                <p className="text-sm text-slate-500">Statut du compte</p>
                <div className="mt-1 flex items-center gap-3">
                  <Badge className={AGENCY_STATUS_COLORS[agency.status] ?? ""}>
                    {label(AGENCY_STATUS_LABELS, agency.status)}
                  </Badge>
                  <span className="text-sm text-slate-600">
                    Offre {nomOffre(agency.plan)}
                  </span>
                </div>
              </div>
              {publicUrl && agency.showcaseEnabled && (
                <Button asChild variant="outline">
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Voir ma vitrine
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Ce que l'offre autorise, et ou en est l'agence (story 6.5,
              FR-13). Affiche meme quand le plafond est loin : on choisit
              son offre en connaissance de cause, pas au moment ou elle
              bloque. */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Votre consommation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Consommation titre="Biens" quota={biens} />
              <Consommation titre="Utilisateurs actifs" quota={comptes} />
            </CardContent>
          </Card>
          {/* Modalités de paiement officielles & renouvellement BaridiMob / CCP */}
          <div className="mb-6">
            <PaymentInstructionsCard
              agencyName={agency.name}
              currentPlan={nomOffre(agency.plan)}
              planPrice={offre(agency.plan).prix}
              paymentDetails={paymentDetails}
              whatsappUrl={whatsappUrl}
            />
          </div>

          <form action={updateSettings} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Coordonnées</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="name">Nom de l&apos;agence *</Label>
                    <Input id="name" name="name" defaultValue={agency.name} required />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Téléphone</Label>
                    <Input id="phone" name="phone" defaultValue={agency.phone ?? ""} />
                  </div>

                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={agency.email} disabled />
                    <p className="text-xs text-slate-500">
                      L&apos;email sert d&apos;identifiant, il ne peut pas être modifié ici.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wilaya">Wilaya</Label>
                    <Input id="wilaya" name="wilaya" defaultValue={agency.wilaya ?? ""} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="commune">Commune</Label>
                    <Input id="commune" name="commune" defaultValue={agency.commune ?? ""} />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address">Adresse</Label>
                    <Input id="address" name="address" defaultValue={agency.address ?? ""} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-slate-400" />
                  Vitrine publique
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4">
                    <input
                      type="checkbox"
                      id="showcaseEnabled"
                      name="showcaseEnabled"
                      defaultChecked={agency.showcaseEnabled}
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />
                    <div>
                      <Label htmlFor="showcaseEnabled" className="font-medium">
                        Publier ma vitrine en ligne
                      </Label>
                      <p className="mt-1 text-sm text-slate-500">
                        Vos biens disponibles seront consultables par vos clients
                        sans compte, et ils pourront vous écrire depuis chaque fiche.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slug">Identifiant de la vitrine</Label>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-500">
                        <Globe className="h-4 w-4" />
                        /vitrine/
                      </span>
                      <Input
                        id="slug"
                        name="slug"
                        defaultValue={agency.slug ?? ""}
                        placeholder={suggestedSlug}
                        pattern="[a-z0-9\-]{3,40}"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Lettres minuscules, chiffres et tirets uniquement. Suggestion :{" "}
                      <code className="rounded bg-slate-100 px-1">{suggestedSlug}</code>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Présentation de l&apos;agence</Label>
                    <Textarea
                      id="description"
                      name="description"
                      rows={4}
                      defaultValue={agency.description ?? ""}
                      placeholder="Quelques lignes affichées en haut de votre vitrine..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Logo</Label>
                    <ImageUploadField
                      name="logo"
                      type="agencies"
                      defaultValue={agency.logo ?? ""}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button type="submit" className="bg-dar-ink hover:bg-dar-blue">
                Enregistrer les paramètres
              </Button>
              <Button variant="outline" asChild>
                <Link href="/agency">Retour au dashboard</Link>
              </Button>
            </div>
          </form>
        </div>
      </main>
    </>
  )
}

/**
 * Un plafond et sa consommation.
 *
 * TROIS ETATS, ET LE TROISIEME EST LE DELICAT.
 *
 *  - illimite : on l'ecrit, on n'invente pas de nombre. Pas de barre non
 *    plus — une jauge sans maximum ne veut rien dire ;
 *  - sous le plafond : le chiffre, et la barre ;
 *  - AU-DESSUS du plafond, apres une retrogradation : l'etat est visible
 *    et NON ALARMISTE (FR-13). La situation est legitime, rien n'est en
 *    danger, rien ne sera supprime (FR-12). Du rouge et un « depassement »
 *    feraient croire a un incident et pousseraient l'agence a effacer des
 *    biens qu'elle a le droit de garder.
 */
function Consommation({ titre, quota }: { titre: string; quota: Quota }) {
  const illimite = quota.plafond === null
  const auDela = quota.plafond !== null && quota.decompte > quota.plafond

  // Bornee a 100 : au-dela, une barre qui deborde de son cadre se lit
  // comme un defaut d'affichage.
  const remplissage =
    quota.plafond === null || quota.plafond === 0
      ? 0
      : Math.min(100, Math.round((quota.decompte / quota.plafond) * 100))

  return (
    <div>
      <p className="text-sm text-slate-500">{titre}</p>
      {/* L'espace est ECRIT, pas seulement dessine par la marge : sans lui
          le texte de la page vaut « 3sur 20 », ce qu'une synthese vocale
          lit tel quel. */}
      <p className="mt-1 font-display text-xl font-semibold text-dar-ink">
        {quota.decompte}{" "}
        <span className="text-sm font-normal text-slate-500">
          sur {formaterPlafond(quota.plafond)}
        </span>
      </p>

      {!illimite && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-dar-sand">
          <div
            className={`h-full rounded-full ${auDela ? "bg-dar-ochre" : "bg-dar-blue"}`}
            style={{ width: `${remplissage}%` }}
          />
        </div>
      )}

      {auDela && (
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Vous êtes au-dessus du plafond de votre offre. Tout est conservé et
          reste modifiable ; seules les créations sont en attente d&apos;une
          place.
        </p>
      )}
    </div>
  )
}
