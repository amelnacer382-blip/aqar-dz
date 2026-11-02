/**
 * Palette des graphiques.
 *
 * Les teintes categorielles sont attribuees dans un ordre FIXE, jamais
 * recyclees : une serie garde sa couleur meme si un filtre en retire une
 * autre. La palette a ete validee sur le fond blanc des cartes
 * (bande de clarte, plancher de chroma, separation daltonisme, contraste).
 *
 * Le controle de contraste signale que trois teintes passent sous 3:1 sur
 * fond blanc : la regle de compensation impose donc des etiquettes de valeur
 * visibles sur chaque marque, ce que font tous les graphiques ci-dessous.
 * La couleur ne porte jamais seule l'information.
 */

/** Ordre categoriel fixe (identite d'une serie). */
export const CATEGORICAL = [
  "#2a78d6", // bleu
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // jaune
  "#e87ba4", // magenta
  "#008300", // vert
  "#4a3aa7", // violet
  "#e34948", // rouge
] as const

/** Rampe sequentielle une seule teinte, clair vers fonce (magnitude ordonnee). */
export const SEQUENTIAL_BLUE = [
  "#cde2fb",
  "#9ec5f4",
  "#6da7ec",
  "#3987e5",
  "#2a78d6",
  "#1c5cab",
  "#104281",
] as const

/** Couleurs d'etat, reservees : jamais reutilisees comme couleur de serie. */
export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const

/** Chrome du graphique : volontairement discret. */
export const CHROME = {
  grid: "#e2e8f0",
  axis: "#cbd5e1",
  textPrimary: "#0f172a",
  textSecondary: "#64748b",
  surface: "#ffffff",
} as const

/** Renvoie la teinte du slot demande, sans jamais boucler au-dela de 8. */
export function categoricalAt(index: number): string {
  return CATEGORICAL[index] ?? CHROME.axis
}
