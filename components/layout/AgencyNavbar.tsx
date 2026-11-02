"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { signOut } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  Store,
  Building2,
  Users,
  UserCheck,
  CalendarDays,
  ShoppingCart,
  KeyRound,
  CreditCard,
  FileText,
  Wallet,
  Inbox,
  BarChart3,
  Settings,
  ScrollText,
  Trash2,
  UsersRound,
  Menu,
  X,
  ChevronDown,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
// `lib/roles` et NON `lib/auth-guard` : ce fichier est un composant client,
// et auth-guard importe prisma, auth et redirect — les tirer ici mettrait
// tout le serveur dans le bundle du navigateur. La regle de role reste
// definie a UN SEUL endroit, auth-guard la re-exporte (story 5.13).
import { peutVoirEspaceAdmin } from "@/lib/roles"

/**
 * La navigation reste strictement horizontale (regle du projet : jamais de
 * sidebar). Comme le nombre de modules depasse ce qu'une barre peut afficher
 * confortablement, les modules secondaires sont regroupes dans deux menus
 * deroulants plutot que de deborder de la barre.
 *
 * `adminSeulement` marque les cinq cibles gardees par `requireAgencyAdmin()`
 * — verifie garde par garde le 14-08-2026 en lisant l'en-tete des dix-sept
 * pages liees. Un agent qui les voyait etait renvoye vers /agency avec un
 * message : le chemin etait correctement traite, mais il lui montrait cinq
 * portes qui ne s'ouvriraient jamais pour lui (story 5.13, REP-78).
 *
 * ATTENTION — ce marquage est un AFFICHAGE, pas une autorisation. Masquer un
 * lien ne garde rien : `lib/auth-guard.ts` reste la seule couche
 * (`CLAUDE.md` §5). Un test verifie que l'acces direct reste refuse, et il
 * est la exactement pour le jour ou quelqu'un lira ce fichier comme une
 * protection.
 */
type LienNav = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminSeulement?: boolean
}

const primaryLinks: LienNav[] = [
  // « Accueil » : seul libelle anglais parmi dix-sept, et le titre de la
  // page est « Tableau de bord » — trop long pour la barre.
  { href: "/agency", label: "Accueil", icon: LayoutDashboard },
  { href: "/agency/showcase", label: "Vitrine", icon: Store, adminSeulement: true },
  { href: "/agency/properties", label: "Biens", icon: Building2 },
  { href: "/agency/clients", label: "Clients", icon: Users },
  { href: "/agency/visits", label: "Visites", icon: CalendarDays },
]

const transactionLinks: LienNav[] = [
  { href: "/agency/sales", label: "Ventes", icon: ShoppingCart },
  { href: "/agency/rentals", label: "Locations", icon: KeyRound },
  { href: "/agency/rental-management", label: "Gestion locative", icon: Wallet },
  { href: "/agency/payments", label: "Paiements", icon: CreditCard },
]

const moreLinks: LienNav[] = [
  { href: "/agency/owners", label: "Propriétaires", icon: UserCheck },
  { href: "/agency/documents", label: "Documents", icon: FileText },
  { href: "/agency/leads", label: "Messages reçus", icon: Inbox },
  { href: "/agency/statistics", label: "Statistiques", icon: BarChart3 },
  { href: "/agency/trash", label: "Corbeille", icon: Trash2, adminSeulement: true },
  { href: "/agency/users", label: "Comptes", icon: UsersRound, adminSeulement: true },
  { href: "/agency/audit", label: "Journal", icon: ScrollText, adminSeulement: true },
  { href: "/agency/settings", label: "Paramètres", icon: Settings, adminSeulement: true },
]

/**
 * Initiale affichee dans la pastille, sans jamais rendre une chaine vide.
 *
 * `Array.from` et non `charAt(0)` : `charAt` indexe par UNITE UTF-16, donc
 * sur un nom commencant par un caractere hors du plan multilingue de base —
 * un emoji, par exemple — il renvoie une demi-paire de substitution, rendue
 * comme un glyphe de remplacement. Le schema de validation n'impose qu'une
 * longueur minimale de 2, qu'un seul emoji satisfait deja (releve en revue,
 * 15-08-2026).
 */
function initiale(nom: string | null | undefined): string {
  const premier = Array.from(nom?.trim() ?? "")[0]
  return premier ? premier.toUpperCase() : "?"
}

export function AgencyNavbar({
  role,
  userName,
}: {
  /**
   * Le role, RELU EN BASE et descendu en props depuis un Server Component.
   * Jamais `session.user.role` ni `useSession()` : le jeton ne dit plus le
   * role depuis la story 1.8, et s'y fier rouvrirait BUG-33 sans qu'aucun
   * signal ne le montre (`CLAUDE.md` §2).
   *
   * OPTIONNEL A DESSEIN. `app/agency/loading.tsx` rend cette barre et ne
   * peut pas connaitre le role : c'est une fonction synchrone, affichee
   * AVANT que la page ne resolve. Son absence vaut donc « role le plus
   * restreint » — arbitrage de l'editeur du 14-08-2026, motif dans la story
   * 5.13. Le repli inverse ferait CLIGNOTER les cinq entrees interdites a
   * chaque navigation, defaisant le masquage a l'instant ou l'agent regarde.
   */
  role?: string
  userName?: string | null
} = {}) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [sortieEnCours, setSortieEnCours] = useState(false)
  const [sortieEnEchec, setSortieEnEchec] = useState(false)

  const estAdmin = peutVoirEspaceAdmin(role)
  const visibles = (liens: LienNav[]) =>
    liens.filter((lien) => !lien.adminSeulement || estAdmin)

  const primaires = visibles(primaryLinks)
  const transactions = visibles(transactionLinks)
  const autres = visibles(moreLinks)
  const allLinks = [...primaires, ...transactions, ...autres]

  /**
   * La deconnexion, et les deux choses qui manquaient (REP-81, REP-83).
   *
   * `signOut` enchaine `getCsrfToken()`, un `fetch` puis `res.json()` SANS
   * garde : si la reponse n'est pas du JSON — derriere nginx sans
   * `AUTH_TRUST_HOST`, l'erreur `UntrustedHost` arrive en HTML — la promesse
   * rejette et `window.location.href` n'est jamais pose. Le bouton parait
   * alors inerte, ce qui est EXACTEMENT le symptome que BUG-35 vient de
   * fermer par un autre chemin.
   *
   * Le repli n'utilise pas de toast : `<Toaster />` n'est monte nulle part
   * dans ce depot (verifie le 14-08-2026), donc un toast ne s'afficherait
   * pas — la meme classe de defaut que la cloche de BUG-35. Le message est
   * rendu dans un bandeau de l'EN-TETE, hors de tout menu : place dans le
   * menu, il disparaissait des que l'utilisateur le fermait (revue du
   * 15-08-2026).
   */
  async function seDeconnecter() {
    if (sortieEnCours) return // pas de second POST pendant que l'appel est en vol
    setSortieEnCours(true)
    setSortieEnEchec(false)
    try {
      await signOut({ callbackUrl: "/auth/login" })
    } catch {
      setSortieEnCours(false)
      setSortieEnEchec(true)
    }
  }

  const isActive = (href: string) =>
    href === "/agency"
      ? pathname === "/agency"
      : pathname === href || pathname.startsWith(`${href}/`)

  const groupActive = (links: { href: string }[]) =>
    links.some((link) => isActive(link.href))

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 border-b border-dar-sand bg-[#F4F5F3]/90 backdrop-blur-md"
    >
      <nav className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/agency" className="flex items-center gap-2.5">
          <span className="arch flex h-8 w-7 items-end justify-center rounded-b-[3px] bg-dar-ink pb-1">
            <Building2 className="h-3.5 w-3.5 text-white" />
          </span>
          {/* « Aqar DZ » et non « Aqar Pro » : le produit porte un seul nom,
              celui du site public, des emails et des documents PDF. */}
          <span className="font-display text-lg font-bold tracking-tight text-dar-ink">
            Aqar<span className="font-medium text-dar-blue"> DZ</span>
          </span>
        </Link>

        {/* Navigation horizontale */}
        <div className="hidden lg:flex items-center gap-1">
          {primaires.map((link) => {
            const Icon = link.icon
            const active = isActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "text-dar-blue" : "text-dar-ink/65 hover:text-dar-ink"
                }`}
              >
                {/*
                  Une seule pastille pour toute la barre : elle glisse d'un
                  onglet a l'autre au lieu de disparaitre puis reapparaitre.
                  L'oeil suit le deplacement et sait d'ou il vient.
                */}
                {active && (
                  <motion.span
                    layoutId="agency-nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-md bg-dar-blue-soft"
                  />
                )}
                <Icon className="relative z-10 h-4 w-4" />
                <span className="relative z-10">{link.label}</span>
              </Link>
            )
          })}

          {/*
            Un groupe vide n'est pas rendu : un menu deroulant qui s'ouvre
            sur rien est precisement le defaut que la story 5.12 vient de
            fermer. Aucun des deux ne se vide avec les roles actuels — les
            quatre liens de « Transactions » sont ouverts a tous, et
            « Plus » en garde quatre pour un agent — mais la garde est posee
            pour le jour ou la repartition changera.
          */}
          {transactions.length > 0 && (
            <NavGroup
              label="Transactions"
              links={transactions}
              isActive={isActive}
              active={groupActive(transactions)}
            />
          )}
          {autres.length > 0 && (
            <NavGroup
              label="Plus"
              links={autres}
              isActive={isActive}
              active={groupActive(autres)}
            />
          )}
        </div>

        {/* Menu utilisateur */}
        <div className="hidden lg:block">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/*
                aria-label stable plutot que l'initiale : sans lui, le nom
                accessible du bouton serait « A », c'est-a-dire la premiere
                lettre du compte connecte. Un test qui viserait cette lettre
                dependrait du jeu de donnees, et deviendrait vert ou rouge
                selon le prenom de l'utilisateur (story 5.13).
              */}
              <Button
                variant="ghost"
                className="flex items-center gap-2"
                aria-label="Menu utilisateur"
              >
                <div className="h-8 w-8 rounded-full bg-dar-blue-soft flex items-center justify-center">
                  <span className="text-sm font-medium text-dar-blue">
                    {initiale(userName)}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-dar-ink/45" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* Le nom reel plutot que « Mon compte » : sur un produit a
                  trois roles ou l'on peut detenir plusieurs comptes, la
                  barre doit dire LEQUEL est ouvert (REP-79). */}
              <DropdownMenuLabel>{userName ?? "Mon compte"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {estAdmin && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/agency/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Paramètres de l&apos;agence
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                className="text-red-600"
                disabled={sortieEnCours}
                onSelect={() => void seDeconnecter()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {sortieEnCours ? "Déconnexion…" : "Déconnexion"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Bouton menu mobile */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-dar-ink/65 hover:text-dar-ink lg:hidden"
          // L'etiquette suit l'etat : elle annoncait « Ouvrir » alors que le
          // bouton fermait, ce qu'un lecteur d'ecran lit a l'envers.
          aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/*
        L'ECHEC DE DECONNEXION SE DIT HORS DES MENUS, et c'est une correction
        de revue (15-08-2026). Le bandeau vivait a l'interieur du menu
        deroulant, avec cette justification : « le menu reste ouvert, c'est le
        seul endroit ou l'echec peut etre annonce ». Elle ne tenait pas —
        Radix ferme le menu sur Echap ou sur un clic exterieur, quoi que
        fasse `preventDefault`. Un utilisateur qui fermait puis ne rouvrait
        pas ne voyait JAMAIS l'echec : le `catch` s'executait dans le vide.
        Le remede rend au passage sa lettre au critere d'acceptation — les
        deux menus se referment de nouveau au clic, comme tous les liens.
      */}
      {sortieEnEchec && (
        <div
          role="alert"
          className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-xs text-red-700"
        >
          La déconnexion a échoué.{" "}
          <a href="/api/auth/signout" className="underline">
            Passer par la page de déconnexion de secours
          </a>{" "}
          — elle demande une confirmation.
        </div>
      )}

      {/* Menu mobile : liste complète à plat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="max-h-[80vh] overflow-y-auto border-b border-dar-sand bg-[#F4F5F3] lg:hidden"
          >
            <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
              {allLinks.map((link) => {
                const Icon = link.icon
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                      isActive(link.href)
                        ? "bg-dar-blue-soft text-dar-blue"
                        : "text-dar-ink/65 hover:bg-white hover:text-dar-ink"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {link.label}
                  </Link>
                )
              })}
              <div className="mt-2 border-t border-dar-sand pt-4">
                <button
                  onClick={() => {
                    setIsOpen(false)
                    void seDeconnecter()
                  }}
                  disabled={sortieEnCours}
                  className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-red-600 w-full disabled:opacity-60"
                >
                  <LogOut className="h-5 w-5" />
                  {sortieEnCours ? "Déconnexion…" : "Déconnexion"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}

function NavGroup({
  label,
  links,
  isActive,
  active,
}: {
  label: string
  links: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[]
  isActive: (href: string) => boolean
  active: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`group relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            active ? "text-dar-blue" : "text-dar-ink/65 hover:text-dar-ink"
          }`}
        >
          {active && (
            <motion.span
              layoutId="agency-nav-pill"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="absolute inset-0 rounded-md bg-dar-blue-soft"
            />
          )}
          <span className="relative z-10">{label}</span>
          <ChevronDown className="relative z-10 h-3.5 w-3.5 transition-transform duration-300 group-data-[state=open]:rotate-180" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {links.map((link) => {
          const Icon = link.icon
          return (
            <DropdownMenuItem key={link.href} asChild>
              <Link
                href={link.href}
                className={isActive(link.href) ? "bg-dar-blue-soft font-medium text-dar-blue" : ""}
              >
                <Icon className="mr-2 h-4 w-4" />
                {link.label}
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
