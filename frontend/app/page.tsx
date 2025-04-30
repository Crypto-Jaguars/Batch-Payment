"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { WalletConnect } from "@/components/wallet-connect"
import { ClaimsList } from "@/components/claims-list"
import { TransactionStatus } from "@/components/transaction-status"
import { NetworkSelector } from "@/components/network-selector"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BatchPaymentForm } from "@/components/batch-payment-form"

export default function Home() {
  const [connected, setConnected] = useState(false)
  const [publicKey, setPublicKey] = useState("")
  const [network, setNetwork] = useState("TESTNET")
  const [txStatus, setTxStatus] = useState<{
    status: "idle" | "loading" | "success" | "error"
    message?: string
    txHash?: string
  }>({ status: "idle" })

  return (
    <main className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold text-center mb-8">Stellar Reward Distribution</h1>

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Wallet Connection</CardTitle>
            <CardDescription>Connect your Stellar wallet to process reward payments</CardDescription>
          </CardHeader>
          <CardContent>
            <NetworkSelector network={network} setNetwork={setNetwork} />
            <div className="mt-4">
              <WalletConnect
                connected={connected}
                setConnected={setConnected}
                publicKey={publicKey}
                setPublicKey={setPublicKey}
                network={network}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reward Distribution</CardTitle>
            <CardDescription>Process reward claims in batches</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="claims">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="claims">Claims Management</TabsTrigger>
                <TabsTrigger value="manual">Manual Batch</TabsTrigger>
              </TabsList>

              <TabsContent value="claims">
                <ClaimsList connected={connected} publicKey={publicKey} network={network} setTxStatus={setTxStatus} />
              </TabsContent>

              <TabsContent value="manual">
                <BatchPaymentForm
                  connected={connected}
                  publicKey={publicKey}
                  network={network}
                  setTxStatus={setTxStatus}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter>
            <TransactionStatus status={txStatus} />
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}

