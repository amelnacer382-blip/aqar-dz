"use client"

import { useState } from "react"
import { UploadDropzone } from "./UploadDropzone"

interface DocumentUploadFieldProps {
  name?: string
  defaultUrl?: string
  sizeName?: string
}

export function DocumentUploadField({ 
  name = "documentUrl", 
  defaultUrl,
  sizeName = "size"
}: DocumentUploadFieldProps) {
  const [url, setUrl] = useState(defaultUrl || "")
  const [size, setSize] = useState("")
  return (
    <div className="space-y-2">
      <UploadDropzone
        type="documents"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onUpload={(result) => {
          setUrl(result.url)
          setSize(result.size.toString())
        }}
      />
      <input type="hidden" name={name} value={url} />
      <input type="hidden" name={sizeName} value={size} />
      {url && (
        <p className="text-sm text-green-600">
          Document uploadé avec succès
        </p>
      )}
    </div>
  )
}
