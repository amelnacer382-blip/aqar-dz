/**
 * Decode la liste d'URL produite par <GalleryUploadField />.
 *
 * Le champ cache serialise les photos en une URL par ligne. On filtre ici
 * pour n'accepter que des chemins internes du dossier d'upload : une URL
 * externe injectee dans le champ cache permettrait sinon d'afficher une
 * image arbitraire sur la vitrine publique de l'agence.
 */
export function parseGalleryUrls(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || raw.trim() === "") {
    return []
  }

  const seen = new Set<string>()

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .filter((line) => /^\/uploads\/[a-z]+\/[A-Za-z0-9._-]+$/.test(line))
    .filter((line) => {
      if (seen.has(line)) return false
      seen.add(line)
      return true
    })
    .slice(0, 12)
}
