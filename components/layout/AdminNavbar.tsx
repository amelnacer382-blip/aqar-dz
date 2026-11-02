"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { signOut } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  Building2,
  Users,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Shield,
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

const navLinks = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/agencies", label: "Agences", icon: Building2 },
  { href: "/admin/users", label: "Utilisateurs", icon: Users },
  { href: "/admin/statistics", label: "Statistiques", icon: BarChart3 },
  { href: "/admin/settings", label: "Paramètres", icon: Settings },
]

/** Initiales affichees dans la pastille, sans jamais rendre une chaine vide. */
function initiales(nom: string | null | undefined): string {
  const mots = nom?.trim().split(/\s+/).filter(Boolean) ?? []
  if (mots.length === 0) return "?"
  // `Array.from` et non un index : indexer une chaine se fait par UNITE
  // UTF-16, donc un nom commencant par un emoji renverrait une demi-paire
  // de substitution (releve en revue, 15-08-2026).
  const tete = (mot: string, n: number) => Array.from(mot).slice(0, n).join("")
  if (mots.length === 1) return tete(mots[0], 2).toUpperCase()
  return (tete(mots[0], 1) + tete(mots[1], 1)).toUpperCase()
}

export function AdminNavbar({
  userName,
}: {
  /**
   * Le nom REEL du compte connecte, relu en base par `requireSuperAdmin()`
   * et descendu en props. Le fichier ecrivait « SA » et « Super Admin » en
   * dur : la barre affichait donc la meme chose quel que soit le compte
   * ouvert (REP-79), ce qui est exactement la question que pose un poste
   * partage — celle que BUG-35 a rendue concrete.
   *
   * Optionnel : `app/admin/loading.tsx` rend cette barre et ne peut pas
   * l'attendre. Il affiche alors « ? », pas un faux nom.
   */
  userName?: string | null
} = {}) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [sortieEnCours, setSortieEnCours] = useState(false)
  const [sortieEnEchec, setSortieEnEchec] = useState(false)

  /**
   * Voir le commentaire jumeau d'`AgencyNavbar` : `signOut` fait un
   * `res.json()` sans garde, donc un echec laisse le bouton parfaitement
   * inerte — le symptome meme de BUG-35, par un autre chemin (REP-81).
   * Pas de toast : `<Toaster />` n'est monte nulle part dans ce depot. Le
   * message est rendu dans un bandeau de l'EN-TETE, hors de tout menu :
   * place dans le menu, il disparaissait des que l'utilisateur le fermait
   * — Radix ferme sur Echap et sur clic exterieur quoi que fasse
   * `preventDefault` (revue du 15-08-2026).
   */
  async function seDeconnecter() {
    if (sortieEnCours) return
    setSortieEnCours(true)
    setSortieEnEchec(false)
    try {
      await signOut({ callbackUrl: "/auth/login" })
    } catch {
      setSortieEnCours(false)
      setSortieEnEchec(true)
    }
  }

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800"
    >
      <nav className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/admin" className="flex items-center gap-2">
          <Shield className="h-7 w-7 text-white" />
          <span className="text-lg font-bold text-white">Aqar Admin</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Right Section */}
        <div className="hidden md:flex items-center gap-3">
          {/*
            La cloche de notifications a ete RETIREE, pas branchee.
            C'etait un bouton sans action, surmonte d'une pastille rouge
            permanente : elle annoncait des messages non lus a un produit
            qui n'a aucune notification. Une decoration qui ment sur l'etat
            du systeme coute plus qu'elle n'apporte — l'editeur cliquait
            sans que rien ne se passe, et rien ne le lui disait.
            Un vrai systeme de notifications est une fonctionnalite, donc
            un PRD, pas une icone a rebrancher.
          */}

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/*
                aria-label stable plutot que les initiales : sans lui, le nom
                accessible du bouton serait « SA », c'est-a-dire les
                initiales du COMPTE DE DEMONSTRATION. Un test qui viserait
                cette chaine passerait par coincidence et casserait au
                premier compte nomme autrement (story 5.13).
              */}
              <Button
                variant="ghost"
                aria-label="Menu utilisateur"
                className="flex items-center gap-2 text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {initiales(userName)}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-slate-900 border-slate-800 text-slate-200">
              <DropdownMenuLabel className="text-slate-200">
                {userName ?? "Console éditeur"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-800" />
              {/*
                « Profil » a ete RETIRE : il n'existe aucune page de profil
                pour un editeur, et il n'y en a jamais eu. L'entree ouvrait
                sur rien. La reintroduire suppose d'abord d'ecrire la page.
              */}
              <DropdownMenuItem asChild className="text-slate-300 hover:text-white hover:bg-slate-800 focus:bg-slate-800">
                <Link href="/admin/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Paramètres
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-800" />
              <DropdownMenuItem
                className="text-red-400 hover:text-red-300 hover:bg-slate-800 focus:bg-slate-800"
                disabled={sortieEnCours}
                onSelect={() => void seDeconnecter()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {sortieEnCours ? "Déconnexion…" : "Déconnexion"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/*
          L'aria-label n'est pas cosmetique : l'icone Lucide n'a pas de
          <title>, donc sans lui le nom accessible du bouton est VIDE.
          AgencyNavbar en avait un depuis l'origine, pas celui-ci — la meme
          asymetrie que celle qui a produit BUG-35. Consequence concrete
          relevee en revue (REP-84) : sans nom accessible, le chemin mobile
          est injoignable par selecteur de role, donc la deconnexion mobile
          etait INTESTABLE — et c'est bien elle que BUG-35 corrige.
        */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={isOpen}
          className="md:hidden p-2 text-slate-300 hover:text-white"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {sortieEnEchec && (
        <div
          role="alert"
          className="border-b border-red-900 bg-red-950 px-4 py-2 text-center text-xs text-red-300"
        >
          La déconnexion a échoué.{" "}
          <a href="/api/auth/signout" className="underline">
            Passer par la page de déconnexion de secours
          </a>{" "}
          — elle demande une confirmation.
        </div>
      )}

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-slate-900 border-b border-slate-800"
          >
            <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
              {navLinks.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-300 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {link.label}
                  </Link>
                )
              })}
              <div className="border-t border-slate-800 pt-4 mt-2">
                <button
                  onClick={() => {
                    setIsOpen(false)
                    void seDeconnecter()
                  }}
                  disabled={sortieEnCours}
                  className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-red-400 w-full disabled:opacity-60"
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
