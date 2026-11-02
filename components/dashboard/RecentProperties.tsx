"use client"

import Link from "next/link"
import Image from "next/image"
import { Building2 } from "lucide-react"
import { Panel, EmptyPanel } from "@/components/dashboard/Panel"

export type PropertyRow = {
  id: string
  title: string
  /** « Vente » ou « Location » : sur un bien qu'on vient d'ajouter, c'est
      l'information qui distingue, la ou le statut vaut presque toujours
      « Disponible ». */
  operationLabel: string
  location: string
  /** Prix deja mis en forme cote serveur : « 85 000 000 DA », « 35 000 DA/mois ». */
  priceLabel: string | null
  imageUrl: string | null
}

/**
 * Les derniers biens entres au portefeuille.
 *
 * La vignette reprend l'arche du produit plutot qu'un carre arrondi : c'est
 * le seul ornement de la ligne, et il porte l'identite la ou l'oeil se pose
 * en premier. Tout le reste de la ligne est mis au repos pour que le titre
 * du bien reste ce qu'on lit.
 */
export function RecentProperties({ properties }: { properties: PropertyRow[] }) {
  return (
    <Panel
      eyebrow="Biens"
      title="Derniers ajouts"
      href="/agency/properties"
      linkLabel="Tout voir"
    >
      {properties.length === 0 ? (
        <EmptyPanel
          icon={<Building2 className="h-10 w-10" />}
          message="Aucun bien enregistré"
          actionLabel="Ajouter un bien"
          actionHref="/agency/properties/new"
        />
      ) : (
        <ul>
          {properties.map((property) => (
            <li key={property.id}>
              <Link
                href={`/agency/properties/${property.id}`}
                className="group flex items-center gap-4 rounded-xl p-4 transition-colors hover:bg-dar-lime"
              >
                <div className="arch relative h-14 w-12 flex-shrink-0 overflow-hidden rounded-b-md bg-dar-sand">
                  {property.imageUrl ? (
                    <Image
                      src={property.imageUrl}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full w-full items-end justify-center pb-2">
                      <Building2 className="h-4 w-4 text-slate-400" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-dar-ink">
                    {property.title}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-slate-500">
                    {property.location}
                  </p>
                  {/* Le prix passe sous le titre en etroit : dans une
                      colonne de droite, il ne laissait plus assez de place
                      au titre, qui se coupait a « Duplex F5 av… ». */}
                  {property.priceLabel && (
                    <p className="mt-1 font-mono text-sm font-medium tabular-nums text-dar-ink sm:hidden">
                      {property.priceLabel}
                    </p>
                  )}
                </div>

                <div className="hidden flex-shrink-0 text-right sm:block">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">
                    {property.operationLabel}
                  </p>
                  {property.priceLabel && (
                    <p className="mt-1.5 font-mono text-sm font-medium tabular-nums text-dar-ink">
                      {property.priceLabel}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
