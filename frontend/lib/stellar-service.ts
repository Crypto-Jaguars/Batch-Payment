import StellarSdk from "stellar-sdk"
import { signWithFreighter } from "@/lib/wallet-utils"

interface Recipient {
  destination: string
  memo?: string
  amount: string
  asset: string
}

interface BatchPaymentParams {
  sourcePublicKey: string
  recipients: Recipient[]
  memo?: string
  network: string
  useBatchMemo?: boolean
}

export async function sendBatchPayment({
  sourcePublicKey,
  recipients,
  memo = "",
  network,
  useBatchMemo = false,
}: BatchPaymentParams) {
  try {
    // Set up the Stellar server based on the network
    const server = new StellarSdk.Server(
      network === "TESTNET" 
        ? "https://horizon-testnet.stellar.org" 
        : "https://horizon.stellar.org"
    )

    // Set the network
    const stellarNetwork = network === "TESTNET" 
      ? StellarSdk.Networks.TESTNET 
      : StellarSdk.Networks.PUBLIC

    // Load the source account
    let sourceAccount = await server.loadAccount(sourcePublicKey)

    // Define maximum operations per transaction
    const MAX_OPS_PER_TX = 100

    // Group recipients by memo to preserve individual transaction details
    const recipientsByMemo: Record<string, Recipient[]> = recipients.reduce((acc: Record<string, Recipient[]>, recipient) => {
      const memoKey = recipient.memo || ""
      if (!acc[memoKey]) acc[memoKey] = []
      acc[memoKey].push(recipient)
      return acc
    }, {} as Record<string, Recipient[]>)

    let lastResult
    let currentAccount = sourceAccount

    // Process each memo group
    const memoKeys = Object.keys(recipientsByMemo)
    for (let i = 0; i < memoKeys.length; i++) {
      const memoKey = memoKeys[i]
      const memoRecipients = recipientsByMemo[memoKey]

      // Split large batches if exceeding max operations
      const recipientBatches = memoRecipients.length > MAX_OPS_PER_TX
        ? chunkArray(memoRecipients, MAX_OPS_PER_TX)
        : [memoRecipients]

      for (const batch of recipientBatches) {
        const transaction = buildTransaction(
          currentAccount, 
          batch, 
          memoKey || memo, 
          stellarNetwork
        )

        lastResult = await signAndSubmitTransaction(
          transaction, 
          stellarNetwork, 
          server, 
          network
        )

        // Reload account for next transaction
        if (batch !== recipientBatches[recipientBatches.length - 1]) {
          await new Promise(resolve => setTimeout(resolve, 5000))
          currentAccount = await server.loadAccount(sourcePublicKey)
        }
      }
    }

    return lastResult
  } catch (error) {
    console.error("Batch Payment Error:", error)
    throw error
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

function buildTransaction(
  sourceAccount: any, 
  recipients: Recipient[], 
  memo: string, 
  stellarNetwork: string
) {
  let transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: stellarNetwork,
  })

  // Add memo if provided
  if (memo) {
    transaction = transaction.addMemo(StellarSdk.Memo.text(memo))
  }

  // Add payment operations
  recipients.forEach(recipient => {
    let asset
    // Determine asset type
    if (recipient.asset === "XLM") {
      asset = StellarSdk.Asset.native()
    } else {
      // Custom asset handling (update with your specific issuers)
      const issuers: Record<string, string> = {
        "USDC": stellarNetwork === StellarSdk.Networks.TESTNET
          ? "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" // Testnet
          : "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" // Mainnet
      }

      const issuer = issuers[recipient.asset]
      if (!issuer) {
        throw new Error(`Unsupported asset: ${recipient.asset}`)
      }

      asset = new StellarSdk.Asset(recipient.asset, issuer)
    }

    transaction = transaction.addOperation(
      StellarSdk.Operation.payment({
        destination: recipient.destination,
        asset: asset,
        amount: recipient.amount,
      })
    )
  })

  return transaction.setTimeout(180).build()
}

async function signAndSubmitTransaction(
  transaction: any, 
  stellarNetwork: string, 
  server: any, 
  network: string
) {
  try {
    // Try to sign with Freighter
    const signedFreighterXDR = await signWithFreighter(transaction.toXDR(), network)

    let signedTransaction
    if (signedFreighterXDR) {
      signedTransaction = StellarSdk.TransactionBuilder.fromXDR(
        signedFreighterXDR, 
        stellarNetwork
      )
    } else {
      // Fallback to Albedo
      const albedo = await import("@albedo-link/intent")
      const { signed_envelope_xdr } = await albedo.default.tx({
        xdr: transaction.toXDR(),
        network: network.toLowerCase(),
      })

      if (!signed_envelope_xdr) {
        throw new Error("Failed to sign transaction with Albedo")
      }

      signedTransaction = StellarSdk.TransactionBuilder.fromXDR(
        signed_envelope_xdr, 
        stellarNetwork
      )
    }

    // Submit the transaction
    const result = await server.submitTransaction(signedTransaction)
    return result
  } catch (error) {
    console.error("Transaction Signing/Submission Error:", error)
    throw error
  }
}