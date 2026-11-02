"use client"

import { useState } from "react"
import { UploadDropzone } from "./UploadDropzone"

interface ImageUploadFieldProps {
  name?: string
  type?: "properties" | "agencies" | "documents"
  defaultValue?: string
}

export function ImageUploadField({ name = "imageUrl", type = "properties", defaultValue }: ImageUploadFieldProps) {
  const [url, setUrl] = useState(defaultValue || "")

  return (
    <div className="space-y-2">
      <UploadDropzone
        type={type}
        onUpload={(result) => setUrl(result.url)}
      />
      <input type="hidden" name={name} value={url} />
      {url && (
        <p className="text-sm text-green-600">
          Image uploadée avec succès
        </p>
      )}
    </div>
  )
}
