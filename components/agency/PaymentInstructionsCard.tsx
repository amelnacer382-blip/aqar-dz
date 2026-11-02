"use client"

import { useState } from "react"
import { Building2, CreditCard, MessageCircle, Phone, Copy, Check, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type PaymentProps = {
  agencyName: string
  currentPlan: string
  planPrice?: string
  paymentDetails: {
    baridimobRip: string
    ccpNumber: string
    ccpKey: string
    bankName: string
    bankRib: string
    beneficiary: string
    supportPhone: string
    supportWhatsapp: string
    supportEmail: string
  }
  whatsappUrl: string
}

export function PaymentInstructionsCard({
  agencyName,
  currentPlan,
  planPrice,
  paymentDetails,
  whatsappUrl,
}: PaymentProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <Card className="border-dar-sand/80 shadow-sm overflow-hidden">
      <CardHeader className="bg-slate-50/70 border-b border-dar-sand/40 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-display text-dar-ink flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-dar-blue" />
              Modalités de règlement & Renouvellement
            </CardTitle>
            <CardDescription className="mt-1 text-slate-600">
              Coordonnées officielles pour régler votre abonnement par BaridiMob, CCP ou Virement bancaire.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-dar-blue/40 text-dar-blue bg-dar-blue/5">
            Abonnement {currentPlan} {planPrice ? `· ${planPrice} DA/mois` : ""}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Grille des 3 modes de paiement algériens */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. BaridiMob */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-dar-ink flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                BaridiMob
              </span>
              <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                Instantané
              </Badge>
            </div>
            <div>
              <p className="text-xs text-slate-500">RIP BaridiMob (20 chiffres)</p>
              <div className="mt-1 flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100 font-mono text-xs">
                <span className="truncate select-all">{paymentDetails.baridimobRip}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(paymentDetails.baridimobRip.replace(/\s+/g, ""), "baridimob")}
                  className="text-slate-400 hover:text-dar-blue ml-2 p-1"
                  title="Copier le RIP"
                >
                  {copiedKey === "baridimob" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Titulaire : <span className="font-medium text-slate-700">{paymentDetails.beneficiary}</span>
            </p>
          </div>

          {/* 2. Compte CCP */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-dar-ink flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                Compte CCP
              </span>
              <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                Poste
              </Badge>
            </div>
            <div>
              <p className="text-xs text-slate-500">Compte CCP + Clé</p>
              <div className="mt-1 flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100 font-mono text-xs">
                <span className="truncate select-all">{paymentDetails.ccpNumber} Clé {paymentDetails.ccpKey}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(`${paymentDetails.ccpNumber} ${paymentDetails.ccpKey}`, "ccp")}
                  className="text-slate-400 hover:text-dar-blue ml-2 p-1"
                  title="Copier le CCP"
                >
                  {copiedKey === "ccp" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Au nom de : <span className="font-medium text-slate-700">{paymentDetails.beneficiary}</span>
            </p>
          </div>

          {/* 3. Virement Bancaire (RIB) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-dar-ink flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-dar-blue" />
                Virement Bancaire
              </span>
              <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                Facture
              </Badge>
            </div>
            <div>
              <p className="text-xs text-slate-500 truncate">{paymentDetails.bankName}</p>
              <div className="mt-1 flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100 font-mono text-xs">
                <span className="truncate select-all">{paymentDetails.bankRib}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(paymentDetails.bankRib.replace(/\s+/g, ""), "rib")}
                  className="text-slate-400 hover:text-dar-blue ml-2 p-1"
                  title="Copier le RIB"
                >
                  {copiedKey === "rib" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Ordre : <span className="font-medium text-slate-700">{paymentDetails.beneficiary}</span>
            </p>
          </div>
        </div>

        {/* Instructions de validation & Action WhatsApp */}
        <div className="rounded-xl bg-dar-ink p-4 sm:p-5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="font-medium text-sm flex items-center gap-2 text-white">
              <FileText className="h-4 w-4 text-emerald-400" />
              Comment activer ou prolonger votre accès :
            </p>
            <p className="text-xs text-white/70 max-w-xl leading-relaxed">
              1. Effectuez votre versement (BaridiMob, CCP ou Virement bancaire).
              <br />
              2. Prenez une photo ou capture du reçu et envoyez-la au support commercial.
              <br />
              3. Votre accès est validé sous <strong>2 heures ouvrées</strong> avec facture acquittée.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
            <Button
              asChild
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs h-9 px-4 gap-1.5 shadow-sm"
            >
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                Transmettre mon reçu via WhatsApp
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs h-9 px-3 gap-1.5"
            >
              <a href={`tel:${paymentDetails.supportPhone.replace(/\s+/g, "")}`}>
                <Phone className="h-3.5 w-3.5" />
                {paymentDetails.supportPhone}
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
