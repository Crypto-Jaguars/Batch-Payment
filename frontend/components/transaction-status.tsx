"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, Loader2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TransactionStatusProps {
  status: {
    status: "idle" | "loading" | "success" | "error"
    message?: string
    txHash?: string
  }
}

export function TransactionStatus({ status }: TransactionStatusProps) {
  if (status.status === "idle") {
    return null
  }

  const getExplorerLink = (hash: string) => {
    return `https://stellar.expert/explorer/public/tx/${hash}`
  }

  if (status.status === "loading") {
    return (
      <Alert className="bg-muted">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <AlertTitle>Processing</AlertTitle>
        <AlertDescription>{status.message || "Transaction is being processed..."}</AlertDescription>
      </Alert>
    )
  }

  if (status.status === "success") {
    return (
      <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-900">
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
        <AlertTitle className="text-green-800 dark:text-green-300">Success</AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-400 flex flex-col gap-2">
          {status.message}
          {status.txHash && (
            <Button
              variant="outline"
              size="sm"
              className="w-fit mt-2 border-green-200 dark:border-green-800"
              onClick={() => window.open(getExplorerLink(status.txHash!), "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Transaction
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  if (status.status === "error") {
    return (
      <Alert className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-900">
        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
        <AlertTitle className="text-red-800 dark:text-red-300">Error</AlertTitle>
        <AlertDescription className="text-red-700 dark:text-red-400">
          {status.message || "An error occurred while processing your transaction."}
        </AlertDescription>
      </Alert>
    )
  }

  return null
}

