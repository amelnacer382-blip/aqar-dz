"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Upload, X, Star, ImageIcon, GripVertical } from "lucide-react"

type GalleryImage = {
  /** Identifiant local, sert uniquement de cle React. */
  key: string
  url: string
}

/**
 * Galerie multi-photos d'un bien.
 *
 * Les URL sont serialisees dans un champ cache unique (separees par des
 * retours a la ligne) : le formulaire reste un <form> HTML classique
 * envoye a une Server Action, sans state cote serveur ni requete
 * intermediaire. La premiere image de la liste est la photo principale.
 */
export function GalleryUploadField({
  name = "imageUrls",
  defaultValue = [],
  max = 12,
}: {
  name?: string
  defaultValue?: string[]
  max?: number
}) {
  const [images, setImages] = useState<GalleryImage[]>(
    defaultValue.map((url, index) => ({ key: `initial-${index}-${url}`, url }))
  )
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    setError(null)
    setIsUploading(true)

    const remaining = max - images.length
    const accepted = files.slice(0, Math.max(remaining, 0))

    if (files.length > accepted.length) {
      setError(`Vous pouvez ajouter au maximum ${max} photos.`)
    }

    try {
      const uploaded: GalleryImage[] = []

      for (const file of accepted) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("type", "properties")

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Erreur lors de l'envoi")
        }

        uploaded.push({ key: `${Date.now()}-${data.url}`, url: data.url })
      }

      setImages((current) => [...current, ...uploaded])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const remove = (key: string) =>
    setImages((current) => current.filter((image) => image.key !== key))

  /** Promeut une image en photo principale en la placant en tete de liste. */
  const makeMain = (key: string) =>
    setImages((current) => {
      const target = current.find((image) => image.key === key)
      if (!target) return current
      return [target, ...current.filter((image) => image.key !== key)]
    })

  const move = (index: number, direction: -1 | 1) =>
    setImages((current) => {
      const next = [...current]
      const target = index + direction
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  return (
    <div className="space-y-4">
      <input
        type="hidden"
        name={name}
        value={images.map((image) => image.url).join("\n")}
      />

      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-slate-400 transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          className="hidden"
        />
        {isUploading ? (
          <div className="text-slate-500">
            <Upload className="mx-auto h-8 w-8 animate-bounce" />
            <p className="mt-2 text-sm">Envoi en cours...</p>
          </div>
        ) : (
          <div className="text-slate-500">
            <ImageIcon className="mx-auto h-8 w-8" />
            <p className="mt-2 text-sm font-medium">
              Cliquez pour ajouter une ou plusieurs photos
            </p>
            <p className="text-xs text-slate-400 mt-1">
              JPG, PNG, WEBP &mdash; 5 Mo par photo &mdash; {images.length}/{max}
            </p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map((image, index) => (
            <div
              key={image.key}
              className="relative group h-28 rounded-lg overflow-hidden border border-slate-200 bg-slate-50"
            >
              {/*
                La HAUTEUR est passee au conteneur : `fill` occupe son
                parent, et un parent sans hauteur se serait effondre — la
                grille aurait perdu ses vignettes sans qu'aucun test ne le
                voie.
              */}
              <Image
                src={image.url}
                alt={`Photo ${index + 1}`}
                fill
                sizes="(max-width: 640px) 33vw, 200px"
                className="object-cover"
              />

              {index === 0 && (
                <span className="absolute top-1 left-1 bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Star className="h-3 w-3 fill-current" />
                  Principale
                </span>
              )}

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-white/90 px-1 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                    title="Déplacer avant"
                  >
                    <GripVertical className="h-3.5 w-3.5 rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === images.length - 1}
                    className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                    title="Déplacer après"
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                  {index !== 0 && (
                    <button
                      type="button"
                      onClick={() => makeMain(image.key)}
                      className="p-1 text-slate-500 hover:text-amber-500"
                      title="Définir comme photo principale"
                    >
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(image.key)}
                  className="p-1 text-slate-500 hover:text-red-600"
                  title="Retirer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
