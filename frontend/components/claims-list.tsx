"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Search, Upload, Download, RefreshCw, Send, AlertCircle } from "lucide-react"
import { sendBatchPayment } from "@/lib/stellar-service"
import { truncateAddress } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Claim {
  id: string
  destination: string
  memo?: string
  amount: string
  asset: string
  status: "pending" | "processed" | "failed"
  timestamp: string
}

interface ClaimsListProps {
  connected: boolean
  publicKey: string
  network: string
  setTxStatus: (status: {
    status: "idle" | "loading" | "success" | "error"
    message?: string
    txHash?: string
  }) => void
}

export function ClaimsList({ connected, publicKey, network, setTxStatus }: ClaimsListProps) {
  const [claims, setClaims] = useState<Claim[]>([])
  const [selectedClaims, setSelectedClaims] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [hasDifferentMemos, setHasDifferentMemos] = useState(false)

  // For demo purposes, generate some sample claims
  useEffect(() => {
    generateSampleClaims()
  }, [])

  // Check if selected claims have different memos
  useEffect(() => {
    if (selectedClaims.length > 1) {
      const selectedClaimsData = claims.filter((claim) => selectedClaims.includes(claim.id))
      const memos = new Set(selectedClaimsData.map((claim) => claim.memo).filter(Boolean))
      setHasDifferentMemos(memos.size > 1)
    } else {
      setHasDifferentMemos(false)
    }
  }, [selectedClaims, claims])

  const generateSampleClaims = () => {
    setIsLoading(true)

    // Generate random Stellar-like addresses
    const generateAddress = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
      let address = "G"
      for (let i = 0; i < 55; i++) {
        address += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return address
    }

    // Generate random amounts between 1 and 100
    const generateAmount = () => {
      return (Math.random() * 99 + 1).toFixed(7)
    }

    // Generate sample memos
    const memos = ["Weekly reward", "Contest winner", "Referral bonus", "Community contribution", "Bug bounty"]

    // Generate sample claims
    const sampleClaims: Claim[] = Array.from({ length: 150 }, (_, i) => ({
      id: `claim-${i + 1}`,
      destination: generateAddress(),
      memo: Math.random() > 0.3 ? memos[Math.floor(Math.random() * memos.length)] : undefined,
      amount: generateAmount(),
      asset: Math.random() > 0.8 ? "USDC" : "XLM",
      status: "pending",
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    }))

    setClaims(sampleClaims)
    setIsLoading(false)
  }

  const handleSelectAll = () => {
    if (selectedClaims.length === filteredClaims.length) {
      setSelectedClaims([])
    } else {
      setSelectedClaims(filteredClaims.map((claim) => claim.id))
    }
  }

  const handleSelectClaim = (id: string) => {
    if (selectedClaims.includes(id)) {
      setSelectedClaims(selectedClaims.filter((claimId) => claimId !== id))
    } else {
      setSelectedClaims([...selectedClaims, id])
    }
  }

  const handleProcessSelected = async () => {
    if (!connected) {
      setTxStatus({
        status: "error",
        message: "Please connect your wallet first",
      })
      return
    }

    if (selectedClaims.length === 0) {
      setTxStatus({
        status: "error",
        message: "Please select at least one claim to process",
      })
      return
    }

    // Get the selected claims
    const claimsToProcess = claims.filter((claim) => selectedClaims.includes(claim.id) && claim.status === "pending")

    if (claimsToProcess.length === 0) {
      setTxStatus({
        status: "error",
        message: "No pending claims selected",
      })
      return
    }

    // Calculate number of transactions needed
    const MAX_OPS_PER_TX = 100
    const numTransactions = Math.ceil(claimsToProcess.length / MAX_OPS_PER_TX)

    setTxStatus({
      status: "loading",
      message:
        numTransactions > 1
          ? `Processing ${claimsToProcess.length} claims in ${numTransactions} transactions...`
          : `Processing ${claimsToProcess.length} claims...`,
    })

    try {
      // Convert claims to recipients format
      const recipients = claimsToProcess.map((claim) => ({
        destination: claim.destination,
        memo: claim.memo,
        amount: claim.amount,
        asset: claim.asset,
      }))

      const result = await sendBatchPayment({
        sourcePublicKey: publicKey,
        recipients,
        network,
        useBatchMemo: false,
      })

      // Update claim statuses
      const updatedClaims = claims.map((claim) => {
        if (selectedClaims.includes(claim.id) && claim.status === "pending") {
          return { ...claim, status: "processed" as const }
        }
        return claim
      })

      setClaims(updatedClaims)
      setSelectedClaims([])

      setTxStatus({
        status: "success",
        message: `Successfully processed ${claimsToProcess.length} claims!`,
        txHash: result.hash,
      })
    } catch (error) {
      console.error("Transaction error:", error)
      setTxStatus({
        status: "error",
        message: error instanceof Error ? error.message : "Transaction failed",
      })
    }
  }

  const exportClaims = () => {
    const claimsToExport =
      selectedClaims.length > 0 ? claims.filter((claim) => selectedClaims.includes(claim.id)) : claims

    const csv = claimsToExport
      .map((claim) => `${claim.destination},${claim.memo || ""},${claim.amount},${claim.asset}`)
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "stellar-claims.csv"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const importClaims = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const lines = content.split("\n")

      const importedClaims = lines
        .map((line, index) => {
          const [destination, memo, amount, asset] = line.split(",").map((s) => s.trim())
          if (!destination || !amount) return null
          return {
            id: `imported-${index}-${Date.now()}`,
            destination,
            memo: memo || undefined,
            amount,
            asset: asset || "XLM",
            status: "pending" as const,
            timestamp: new Date().toISOString(),
          }
        })
        .filter((c): c is NonNullable<typeof c> => c !== null)

      if (importedClaims.length > 0) {
        setClaims(importedClaims)
      }
    }

    reader.readAsText(file)
    // Reset the input value so the same file can be selected again
    e.target.value = ""
  }

  // Filter claims based on search term
  const filteredClaims = claims.filter((claim) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      claim.destination.toLowerCase().includes(searchLower) ||
      claim.id.toLowerCase().includes(searchLower) ||
      claim.amount.includes(searchTerm) ||
      (claim.memo && claim.memo.toLowerCase().includes(searchLower)) ||
      claim.asset.toLowerCase().includes(searchLower) ||
      claim.status.toLowerCase().includes(searchLower)
    )
  })

  // Calculate totals
  const selectedTotal = claims
    .filter((claim) => selectedClaims.includes(claim.id) && claim.status === "pending")
    .reduce((total, claim) => {
      if (claim.asset === "XLM") {
        return total + Number.parseFloat(claim.amount)
      }
      return total
    }, 0)

  const selectedUSDCTotal = claims
    .filter((claim) => selectedClaims.includes(claim.id) && claim.status === "pending")
    .reduce((total, claim) => {
      if (claim.asset === "USDC") {
        return total + Number.parseFloat(claim.amount)
      }
      return total
    }, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search claims..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" onClick={generateSampleClaims} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
        <Button variant="outline" size="icon" onClick={exportClaims}>
          <Download className="h-4 w-4" />
        </Button>
        <label className="cursor-pointer">
          <Button variant="outline" size="icon" onClick={() => document.getElementById("claims-upload")?.click()}>
            <Upload className="h-4 w-4" />
          </Button>
          <input id="claims-upload" type="file" accept=".csv,text/csv" className="hidden" onChange={importClaims} />
        </label>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="select-all"
            checked={selectedClaims.length > 0 && selectedClaims.length === filteredClaims.length}
            onCheckedChange={handleSelectAll}
          />
          <Label htmlFor="select-all">
            {selectedClaims.length > 0 ? `Selected ${selectedClaims.length} of ${filteredClaims.length}` : "Select All"}
          </Label>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-primary/10">
            Pending: {claims.filter((c) => c.status === "pending").length}
          </Badge>
          <Badge variant="outline" className="bg-green-500/10">
            Processed: {claims.filter((c) => c.status === "processed").length}
          </Badge>
        </div>
      </div>

      <Card>
        <ScrollArea className="h-[400px]">
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="p-3 text-left font-medium text-xs"></th>
                  <th className="p-3 text-left font-medium text-xs">ID</th>
                  <th className="p-3 text-left font-medium text-xs">Destination</th>
                  <th className="p-3 text-left font-medium text-xs">Memo</th>
                  <th className="p-3 text-right font-medium text-xs">Amount</th>
                  <th className="p-3 text-left font-medium text-xs">Asset</th>
                  <th className="p-3 text-left font-medium text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.map((claim) => (
                  <tr key={claim.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="p-3">
                      <Checkbox
                        checked={selectedClaims.includes(claim.id)}
                        onCheckedChange={() => handleSelectClaim(claim.id)}
                        disabled={claim.status !== "pending"}
                      />
                    </td>
                    <td className="p-3 text-sm">{claim.id}</td>
                    <td className="p-3 text-sm font-mono">{truncateAddress(claim.destination)}</td>
                    <td className="p-3 text-sm">
                      {claim.memo ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="text-left max-w-[120px] truncate block">
                              {claim.memo}
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{claim.memo}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 text-sm text-right tabular-nums">{claim.amount}</td>
                    <td className="p-3 text-sm">{claim.asset}</td>
                    <td className="p-3">
                      <Badge
                        variant={claim.status === "processed" ? "secondary" : "outline"}
                        className={
                          claim.status === "pending"
                            ? "bg-primary/10"
                            : claim.status === "processed"
                              ? "bg-green-500/10"
                              : "bg-red-500/10"
                        }
                      >
                        {claim.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </ScrollArea>
      </Card>

      {selectedClaims.length > 0 && (
        <div className="bg-muted p-4 rounded-md space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Selected Claims:</span>
            <span className="font-medium">{selectedClaims.length}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedTotal > 0 && (
              <Badge variant="outline" className="bg-primary/10">
                {selectedTotal.toFixed(7)} XLM
              </Badge>
            )}

            {selectedUSDCTotal > 0 && (
              <Badge variant="outline" className="bg-primary/10">
                {selectedUSDCTotal.toFixed(7)} USDC
              </Badge>
            )}

            {Math.ceil(selectedClaims.length / 100) > 1 && (
              <Badge variant="outline">{Math.ceil(selectedClaims.length / 100)} Transactions</Badge>
            )}
          </div>

          {hasDifferentMemos && (
            <Alert variant="warning" className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                Selected claims have different memos. Multiple transactions will be created to preserve individual
                memos.
              </AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full"
            onClick={handleProcessSelected}
            disabled={!connected || selectedClaims.length === 0}
          >
            <Send className="h-4 w-4 mr-2" />
            Process Selected Claims
          </Button>
        </div>
      )}
    </div>
  )
}

