"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Copy, Check, ExternalLink } from "lucide-react"
import { truncateAddress } from "@/lib/utils"
import { Networks } from "stellar-sdk"

interface WalletConnectProps {
  connected: boolean
  setConnected: (connected: boolean) => void
  publicKey: string
  setPublicKey: (publicKey: string) => void
  network: string
}

export function WalletConnect({ 
  connected, 
  setConnected, 
  publicKey, 
  setPublicKey, 
  network 
}: WalletConnectProps) {
  const [walletType, setWalletType] = useState<"freighter" | "albedo" | null>(null)
  const [copied, setCopied] = useState(false)

  // Check if wallets are available
  const [freighterAvailable, setFreighterAvailable] = useState(false)
  const [albedoAvailable, setAlbedoAvailable] = useState(false)

  useEffect(() => {
    const checkWallets = async () => {
      // Check Freighter
      if ((window as any).freighter) {
        try {
          const connected = await (window as any).freighter.isConnected()
          setFreighterAvailable(connected)
        } catch (e) {
          setFreighterAvailable(false)
        }
      }

      // Check Albedo (always considered available as it's a web service)
      setAlbedoAvailable(true)
    }

    checkWallets()
  }, [])

  const connectFreighter = async () => {
    try {
      // Check if Freighter is available
      if (!(window as any).freighter) {
        window.open("https://www.freighter.app/", "_blank")
        return
      }

      // Set network
      await (window as any).freighter.setNetwork(network.toLowerCase())
      
      // Get public key
      const freighterPublicKey = await (window as any).freighter.getPublicKey()

      setPublicKey(freighterPublicKey)
      setConnected(true)
      setWalletType("freighter")
    } catch (e) {
      console.error("Error connecting to Freighter:", e)
      // Optionally show error toast or alert
    }
  }

  const connectAlbedo = async () => {
    try {
      // Dynamically import Albedo
      const albedo = await import("@albedo-link/intent")

      const { pubkey } = await albedo.default.publicKey({})

      setPublicKey(pubkey)
      setConnected(true)
      setWalletType("albedo")
    } catch (e) {
      console.error("Error connecting to Albedo:", e)
      // Optionally show error toast or alert
    }
  }

  const disconnectWallet = () => {
    setConnected(false)
    setPublicKey("")
    setWalletType(null)
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(publicKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getExplorerLink = () => {
    const baseUrl = network === "TESTNET"
      ? "https://stellar.expert/explorer/testnet/account/"
      : "https://stellar.expert/explorer/public/account/"
    return `${baseUrl}${publicKey}`
  }

  if (connected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">
            Connected with {walletType === "freighter" ? "Freighter" : "Albedo"}
          </div>
          <Button variant="ghost" size="sm" onClick={disconnectWallet}>
            Disconnect
          </Button>
        </div>

        <Card className="p-3 flex items-center justify-between bg-muted">
          <div className="font-mono text-sm">{truncateAddress(publicKey)}</div>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={copyAddress}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => window.open(getExplorerLink(), "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Button 
        className="w-full" 
        onClick={connectFreighter} 
        disabled={!freighterAvailable}
      >
        {freighterAvailable ? "Connect with Freighter" : "Freighter Not Available"}
      </Button>
      <Button 
        variant="outline" 
        className="w-full" 
        onClick={connectAlbedo}
        disabled={!albedoAvailable}
      >
        {albedoAvailable ? "Connect with Albedo" : "Albedo Not Available"}
      </Button>
    </div>
  )
}