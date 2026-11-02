"use client"

import { useState } from "react"
import Image from "next/image"
import { Building2, ChevronLeft, ChevronRight } from "lucide-react"

/** Galerie photo d'un bien : grande image + vignettes cliquables. */
export function PropertyGallery({
  images,
  title,
}: {
  images: string[]
  title: string
}) {
  const [index, setIndex] = useState(0)

  if (images.length === 0) {
    return (
      <div className="aspect-[16/10] w-full rounded-xl bg-slate-100 flex items-center justify-center">
        <Building2 className="h-16 w-16 text-slate-300" />
      </div>
    )
  }

  const go = (direction: -1 | 1) =>
    setIndex((current) => (current + direction + images.length) % images.length)

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-slate-100">
        {/*
          `priority` sur la PREMIERE photo seulement : sur la fiche d'un
          bien, c'est elle le plus grand element rendu au premier ecran,
          donc elle EST le LCP. Le differer reviendrait a retarder la
          mesure qu'on cherche a ameliorer.
        */}
        <Image
          src={images[index]}
          alt={`${title} — photo ${index + 1}`}
          fill
          sizes="(max-width: 1024px) 100vw, 768px"
          priority={index === 0}
          className="object-cover"
        />

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Photo précédente"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
            >
              <ChevronLeft className="h-5 w-5 text-slate-700" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Photo suivante"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow hover:bg-white"
            >
              <ChevronRight className="h-5 w-5 text-slate-700" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
              {index + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Voir la photo ${i + 1}`}
              className={`relative aspect-[4/3] overflow-hidden rounded-lg border-2 transition-colors ${
                i === index ? "border-slate-900" : "border-transparent hover:border-slate-300"
              }`}
            >
              {/* Les vignettes sont sous le premier ecran : chargement differe. */}
              <Image
                src={url}
                alt=""
                fill
                sizes="(max-width: 640px) 20vw, 128px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
