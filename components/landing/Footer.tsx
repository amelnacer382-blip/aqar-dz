import Link from "next/link"
import { Building2 } from "lucide-react"

export function Footer() {
  return (
    <footer className="bg-dar-ink py-16 text-white/70">
      <div className="container mx-auto px-4">
        <div className="mb-12 grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link href="/" className="mb-5 flex items-center gap-2.5">
              <span className="arch flex h-8 w-7 items-end justify-center rounded-b-[3px] bg-white pb-1">
                <Building2 className="h-3.5 w-3.5 text-dar-ink" />
              </span>
              <span className="font-display text-xl font-bold tracking-tight text-white">
                Aqar DZ
              </span>
            </Link>
            <p className="max-w-sm leading-relaxed text-white/60">
              Le logiciel de gestion et la vitrine en ligne des agences
              immobilières algériennes.
            </p>
          </div>

          <div>
            <h3 className="mb-4 font-display font-semibold text-white">Produit</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="#features" className="transition-colors hover:text-white">
                  Fonctionnalités
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="transition-colors hover:text-white">
                  Tarifs
                </Link>
              </li>
              <li>
                <Link href="/vitrine/agence-demo" className="transition-colors hover:text-white">
                  Exemple de vitrine
                </Link>
              </li>
              <li>
                <Link href="/auth/register" className="transition-colors hover:text-white">
                  Inscrire mon agence
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-display font-semibold text-white">Légal</h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="#" className="transition-colors hover:text-white">
                  Conditions d&apos;utilisation
                </Link>
              </li>
              <li>
                <Link href="#" className="transition-colors hover:text-white">
                  Politique de confidentialité
                </Link>
              </li>
              <li>
                <Link href="#" className="transition-colors hover:text-white">
                  Mentions légales
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-3 border-t border-white/10 pt-8 text-sm text-white/40">
          <p>© {new Date().getFullYear()} Aqar DZ. Tous droits réservés.</p>
          {/*
            Les photographies sont sous licence Creative Commons : la mention
            de l'auteur et de la licence est une obligation, pas une option.
          */}
          <p className="text-xs leading-relaxed">
            Photographies de la Casbah d&apos;Alger, via Wikimedia Commons :
            intérieur de maison &mdash;{" "}
            <a
              href="https://commons.wikimedia.org/wiki/File:Casbah_of_Algiers,_house_interior.jpg"
              className="underline underline-offset-2 hover:text-white/70"
              target="_blank"
              rel="noopener noreferrer license"
            >
              CC BY-SA 2.0
            </a>{" "}
            ; porte sculptée, par Rachid Hamatou &mdash;{" "}
            <a
              href="https://commons.wikimedia.org/wiki/File:Architectural_and_Cultural_Heritage_of_the_Casbah_of_Algiers_6.jpg"
              className="underline underline-offset-2 hover:text-white/70"
              target="_blank"
              rel="noopener noreferrer license"
            >
              CC BY-SA 4.0
            </a>
            . Autres visuels : Unsplash.
          </p>
        </div>
      </div>
    </footer>
  )
}
