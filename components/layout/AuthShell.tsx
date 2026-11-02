import Link from "next/link"
import { Building2 } from "lucide-react"
import { PhotoBackdrop, type BackdropPhoto } from "@/components/motion/PhotoBackdrop"
import { CASBAH_TALL } from "@/lib/photos"

/**
 * Cadre commun aux ecrans d'authentification.
 *
 * A gauche le formulaire, a droite les maisons de la Casbah qui se succedent
 * en fondu : arriver sur la connexion doit deja donner a voir le metier. Le
 * defilement est lent (12 s par photo) — le panneau n'est pas mort, mais il
 * ne dispute jamais l'attention a la saisie du mot de passe. Le panneau
 * disparait sous 1024px pour laisser toute la largeur au formulaire.
 */
export function AuthShell({
  children,
  quote = "Une arche en ouvre une autre.",
  caption = "Maisons de la Casbah, Alger",
  photos = CASBAH_TALL,
  panel,
  wide = false,
}: {
  children: React.ReactNode
  quote?: string
  caption?: string
  photos?: BackdropPhoto[]
  /** Remplace le panneau photographique, quand l'ecran a mieux a montrer. */
  panel?: React.ReactNode
  /** Colonne de saisie elargie, pour les formulaires a deux colonnes. */
  wide?: boolean
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Formulaire */}
      <div className="limewash flex flex-col justify-center px-5 py-12 sm:px-10 lg:px-16">
        <div
          className={`mx-auto w-full animate-rise-in ${wide ? "max-w-xl" : "max-w-md"}`}
        >
          <Link href="/" className="group mb-10 inline-flex items-center gap-2.5">
            <span className="arch flex h-9 w-8 items-end justify-center rounded-b-[3px] bg-dar-ink pb-1 transition-colors duration-300 group-hover:bg-dar-blue">
              <Building2 className="h-4 w-4 text-white" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight text-dar-ink">
              Aqar DZ
            </span>
          </Link>

          {children}
        </div>
      </div>

      {/* Panneau de droite : photographie par defaut, sauf ecran fourni */}
      <div className="relative hidden overflow-hidden bg-dar-ink lg:block">
        {panel ?? (
          <>
            <PhotoBackdrop photos={photos} interval={12000} />
            <div className="photo-scrim absolute inset-0 opacity-80" />

            <figure className="absolute inset-x-0 bottom-0 p-12">
              <blockquote className="max-w-sm animate-rise-in font-display text-3xl font-semibold leading-snug tracking-tight text-white [animation-delay:200ms]">
                {quote}
              </blockquote>
              <figcaption className="mt-4 animate-rise-in font-mono text-[11px] uppercase tracking-widest text-white/55 [animation-delay:340ms]">
                {caption}
              </figcaption>
            </figure>
          </>
        )}
      </div>
    </div>
  )
}
