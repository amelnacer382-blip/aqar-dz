"use client"

import { useState, useRef } from "react"
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react"

export interface UploadResult {
  url: string
  filename: string
  size: number
}

interface UploadDropzoneProps {
  onUpload: (result: UploadResult) => void
  type: "properties" | "agencies" | "documents"
  accept?: string
  maxSize?: number // en MB
}

export function UploadDropzone({ onUpload, type, accept = "image/*", maxSize = 5 }: UploadDropzoneProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", type)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'upload")
      }

      onUpload({
        url: data.url,
        filename: data.filename,
        size: data.size,
      })

      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreview(reader.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        setPreview("document")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = () => {
    setPreview(null)
    setError(null)
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-slate-400 transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
        {isUploading ? (
          <div className="text-slate-500">
            <Upload className="mx-auto h-8 w-8 animate-bounce" />
            <p className="mt-2 text-sm">Upload en cours...</p>
          </div>
        ) : preview ? (
          <div className="relative inline-block">
            {preview === "document" ? (
              <FileText className="mx-auto h-16 w-16 text-slate-400" />
            ) : (
              /*
                LA SEULE BALISE `<img>` QUI RESTE DU PRODUIT, et c'est un
                choix mesure (story 3.7). `preview` est une URL `data:`
                produite par `FileReader` sur le fichier que l'utilisateur
                vient de choisir : elle n'existe que dans cet onglet, elle
                n'a jamais transite par le reseau, et le serveur ne peut pas
                l'optimiser puisqu'il ne l'a jamais vue. La passer a
                `next/image` demanderait `unoptimized`, c'est-a-dire une
                balise `<img>` deguisee — avec en prime un aller-retour
                inutile vers /_next/image.
                Il n'y a donc RIEN a gagner ici : l'image est deja sur la
                machine de celui qui la regarde.
              */
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Preview" className="max-h-32 mx-auto rounded" />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleRemove()
              }}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="text-slate-500">
            <ImageIcon className="mx-auto h-8 w-8" />
            <p className="mt-2 text-sm font-medium">Cliquez pour selectionner un fichier</p>
            <p className="text-xs text-slate-400 mt-1">
              {accept.includes("image") ? "JPG, PNG, WEBP" : "PDF, images"} - Max {maxSize}MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
      )}
    </div>
  )
}
