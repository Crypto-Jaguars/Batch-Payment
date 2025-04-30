/**
 * Utility functions for wallet interactions and detection
 */

/**
 * Safely detects if Freighter wallet is available
 */
export async function detectFreighter(): Promise<boolean> {
  // Check browser environment
  if (typeof window === "undefined") return false

  // Check if Freighter is injected
  const freighterInjected = !!(window as any).freighter

  if (!freighterInjected) return false

  // Check Freighter connection
  try {
    return await (window as any).freighter?.isConnected() || false
  } catch (e) {
    console.error("Freighter connection check error:", e)
    return false
  }
}

/**
 * Safely retrieves Freighter public key
 */
export async function getFreighterPublicKey(): Promise<string | null> {
  // Check browser environment
  if (typeof window === "undefined") return null

  // Check if Freighter is injected
  const freighterInjected = !!(window as any).freighter

  if (!freighterInjected) return null

  try {
    return await (window as any).freighter?.getPublicKey() || null
  } catch (e) {
    console.error("Error getting Freighter public key:", e)
    return null
  }
}

/**
 * Safely sets Freighter network
 */
export async function setFreighterNetwork(network: string): Promise<boolean> {
  // Check browser environment
  if (typeof window === "undefined") return false

  // Check if Freighter is injected
  const freighterInjected = !!(window as any).freighter

  if (!freighterInjected) return false

  try {
    await (window as any).freighter?.setNetwork(network.toLowerCase())
    return true
  } catch (e) {
    console.error("Error setting Freighter network:", e)
    return false
  }
}

/**
 * Safely signs a transaction with Freighter
 */
export async function signWithFreighter(
  xdr: string, 
  network: string
): Promise<string | null> {
  // Check browser environment
  if (typeof window === "undefined") return null

  // Check if Freighter is injected
  const freighterInjected = !!(window as any).freighter
  if (!freighterInjected) return null

  try {
    await (window as any).freighter?.setNetwork(network.toLowerCase())
    return await (window as any).freighter?.signTransaction(xdr) || null
  } catch (e) {
    console.error("Error signing with Freighter:", e)
    return null
  }
}