"use client"

import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface NetworkSelectorProps {
  network: string
  setNetwork: (network: string) => void
}

export function NetworkSelector({ network, setNetwork }: NetworkSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Network</Label>
      <RadioGroup defaultValue={network} onValueChange={setNetwork} className="flex gap-4">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="TESTNET" id="testnet" />
          <Label htmlFor="testnet" className="cursor-pointer">
            Testnet
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="PUBLIC" id="mainnet" />
          <Label htmlFor="mainnet" className="cursor-pointer">
            Mainnet
          </Label>
        </div>
      </RadioGroup>
    </div>
  )
}

