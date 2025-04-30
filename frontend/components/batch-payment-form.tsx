"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Plus, Upload, Download, AlertCircle } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { sendBatchPayment } from "@/lib/stellar-service"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Recipient {
  destination: string
  memo?: string
  amount: string
  asset: string
}

interface BatchPaymentFormProps {
  connected: boolean
  publicKey: string
  network: string
  setTxStatus: (status: {
    status: "idle" | "loading" | "success" | "error"
    message?: string
    txHash?: string
  }) => void
}

export function BatchPaymentForm({ connected, publicKey, network, setTxStatus }: BatchPaymentFormProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([{ destination: "", amount: "", asset: "XLM" }])
  const [bulkAddresses, setBulkAddresses] = useState("")
  const [hasDifferentMemos, setHasDifferentMemos] = useState(false)

  // For transaction splitting calculation
  const MAX_OPS_PER_TX = 100

  const addRecipient = () => {
    setRecipients([...recipients, { destination: "", amount: "", asset: "XLM" }])
    checkForDifferentMemos([...recipients, { destination: "", amount: "", asset: "XLM" }])
  }

  const removeRecipient = (index: number) => {
    const newRecipients = [...recipients]
    newRecipients.splice(index, 1)
    setRecipients(newRecipients)
    checkForDifferentMemos(newRecipients)
  }

  const updateRecipient = (index: number, field: keyof Recipient, value: string) => {
    const newRecipients = [...recipients]
    newRecipients[index] = { ...newRecipients[index], [field]: value }
    setRecipients(newRecipients)

    if (field === "memo") {
      checkForDifferentMemos(newRecipients)
    }
  }

  const checkForDifferentMemos = (recipientsList: Recipient[]) => {
    const memos = new Set(recipientsList.map((r) => r.memo).filter(Boolean))
    setHasDifferentMemos(memos.size > 1)
  }

  const processBulkAddresses = () => {
    if (!bulkAddresses.trim()) return

    // Split by newlines and filter out empty strings
    const lines = bulkAddresses
      .split(/[\n]/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    // Create new recipients with these addresses
    // Format: address,memo(optional),amount,asset
    const newRecipients = lines.map((line) => {
      const [destination, memo, amount, asset = "XLM"] = line.split(",").map((s) => s.trim())
      return {
        destination: destination || "",
        memo: memo || undefined,
        amount: amount || "",
        asset: asset || "XLM",
      }
    })

    if (newRecipients.length > 0) {
      setRecipients(newRecipients)
      setBulkAddresses("")
      checkForDifferentMemos(newRecipients)
    }
  }

  const exportRecipients = () => {
    const csv = recipients.map((r) => `${r.destination},${r.memo || ""},${r.amount},${r.asset}`).join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "stellar-batch-recipients.csv"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const importRecipients = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      const lines = content.split("\n")

      const importedRecipients = lines
        .map((line) => {
          const [destination, memo, amount, asset] = line.split(",").map((s) => s.trim())
          if (!destination) return null
          return {
            destination,
            memo: memo || undefined,
            amount: amount || "",
            asset: asset || "XLM",
          }
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)

      if (importedRecipients.length > 0) {
        setRecipients(importedRecipients)
        checkForDifferentMemos(importedRecipients)
      }
    }

    reader.readAsText(file)
    // Reset the input value so the same file can be selected again
    e.target.value = ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!connected) {
      setTxStatus({
        status: "error",
        message: "Please connect your wallet first",
      })
      return
    }

    // Validate inputs
    const invalidRecipients = recipients.filter((r) => !r.destination || !r.amount || Number.parseFloat(r.amount) <= 0)

    if (invalidRecipients.length > 0) {
      setTxStatus({
        status: "error",
        message: "Please fill in all recipient details with valid amounts",
      })
      return
    }

    // Calculate number of transactions needed
    const numTransactions = Math.ceil(recipients.length / MAX_OPS_PER_TX)

    setTxStatus({
      status: "loading",
      message:
        numTransactions > 1
          ? `Building and submitting ${numTransactions} transactions...`
          : "Building and submitting transaction...",
    })

    try {
      const result = await sendBatchPayment({
        sourcePublicKey: publicKey,
        recipients,
        network,
        useBatchMemo: false,
      })

      setTxStatus({
        status: "success",
        message: "Transaction successful!",
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Manual Batch Payment</h3>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportRecipients}
            disabled={recipients.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <label className="cursor-pointer">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => document.getElementById("csv-upload")?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <input id="csv-upload" type="file" accept=".csv,text/csv" className="hidden" onChange={importRecipients} />
          </label>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="bulk-addresses">Paste multiple entries (format: address,memo,amount,asset)</Label>
          <Textarea
            id="bulk-addresses"
            value={bulkAddresses}
            onChange={(e) => setBulkAddresses(e.target.value)}
            placeholder="G...,Weekly reward,10.5,XLM
G...,Contest winner,25,USDC
G...,,5,XLM"
            className="font-mono text-sm h-[100px]"
          />
          <Button type="button" onClick={processBulkAddresses} className="mt-2" disabled={!bulkAddresses.trim()}>
            Add Recipients
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-medium">Recipients ({recipients.length})</h3>
            </div>

            {recipients.length > 5 && (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-4">
                  {recipients.map((recipient, index) => (
                    <RecipientRow
                      key={index}
                      recipient={recipient}
                      index={index}
                      updateRecipient={updateRecipient}
                      removeRecipient={removeRecipient}
                      canRemove={recipients.length > 1}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}

            {recipients.length <= 5 && (
              <div className="space-y-4">
                {recipients.map((recipient, index) => (
                  <RecipientRow
                    key={index}
                    recipient={recipient}
                    index={index}
                    updateRecipient={updateRecipient}
                    removeRecipient={removeRecipient}
                    canRemove={recipients.length > 1}
                  />
                ))}
              </div>
            )}

            <Button type="button" variant="outline" size="sm" onClick={addRecipient} className="mt-4 flex items-center">
              <Plus className="h-4 w-4 mr-2" />
              Add Recipient
            </Button>
          </CardContent>
        </Card>
      </div>

      {hasDifferentMemos && (
        <Alert variant="warning" className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-900">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
            Recipients have different memos. Multiple transactions will be created to preserve individual memos.
          </AlertDescription>
        </Alert>
      )}

      {recipients.length > 0 && (
        <div className="bg-muted p-4 rounded-md space-y-2">
          <div className="flex justify-between">
            <span className="text-sm">Total Recipients:</span>
            <span className="font-medium">{recipients.length}</span>
          </div>

          {recipients.length > MAX_OPS_PER_TX && (
            <div className="flex justify-between">
              <span className="text-sm">Transactions Required:</span>
              <Badge variant="outline">{Math.ceil(recipients.length / MAX_OPS_PER_TX)}</Badge>
            </div>
          )}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={!connected || recipients.length === 0 || recipients.some((r) => !r.destination || !r.amount)}
      >
        Send Batch Payment
      </Button>
    </form>
  )
}

// Helper component for recipient rows
function RecipientRow({
  recipient,
  index,
  updateRecipient,
  removeRecipient,
  canRemove,
}: {
  recipient: Recipient
  index: number
  updateRecipient: (index: number, field: keyof Recipient, value: string) => void
  removeRecipient: (index: number) => void
  canRemove: boolean
}) {
  return (
    <div className="grid grid-cols-12 gap-3 items-end">
      <div className="col-span-4">
        <Label htmlFor={`destination-${index}`} className="sr-only">
          Destination Address
        </Label>
        <Input
          id={`destination-${index}`}
          value={recipient.destination}
          onChange={(e) => updateRecipient(index, "destination", e.target.value)}
          placeholder="G..."
          className="font-mono text-sm"
        />
      </div>
      <div className="col-span-2">
        <Label htmlFor={`memo-${index}`} className="sr-only">
          Memo
        </Label>
        <Input
          id={`memo-${index}`}
          value={recipient.memo || ""}
          onChange={(e) => updateRecipient(index, "memo", e.target.value)}
          placeholder="Memo"
        />
      </div>
      <div className="col-span-2">
        <Label htmlFor={`amount-${index}`} className="sr-only">
          Amount
        </Label>
        <Input
          id={`amount-${index}`}
          type="number"
          step="0.0000001"
          min="0"
          value={recipient.amount}
          onChange={(e) => updateRecipient(index, "amount", e.target.value)}
          placeholder="0.0"
        />
      </div>
      <div className="col-span-3">
        <Label htmlFor={`asset-${index}`} className="sr-only">
          Asset
        </Label>
        <Select value={recipient.asset} onValueChange={(value) => updateRecipient(index, "asset", value)}>
          <SelectTrigger id={`asset-${index}`}>
            <SelectValue placeholder="Select asset" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="XLM">XLM</SelectItem>
            <SelectItem value="USDC">USDC</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-1">
        <Button type="button" variant="ghost" size="icon" onClick={() => removeRecipient(index)} disabled={!canRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

