import { SorobanRpc, Address, Contract, Networks, TransactionBuilder, 
  BASE_FEE, TimeoutInfinite, xdr, nativeToScVal, Operation } from 'stellar-sdk';
import { Keypair } from 'stellar-sdk';
import { readFileSync } from 'fs';
import path from 'path';

// Global Soroban configuration
let server: SorobanRpc.Server;
let networkPassphrase: string;
let contract: Contract;
let adminKeypair: Keypair;
let adminAddress: Address;

export function initSorobanConfig() {
  if (!process.env.CONTRACT_ID || !process.env.ADMIN_SECRET_KEY) {
    throw new Error('Missing required environment variables: CONTRACT_ID, ADMIN_SECRET_KEY');
  }

  // Initialize Stellar SDK
  const network = process.env.NETWORK || 'TESTNET';
  networkPassphrase = network === 'TESTNET' ? Networks.TESTNET : Networks.PUBLIC;
  
  // Initialize server
  server = new SorobanRpc.Server(
    network === 'TESTNET' 
      ? 'https://soroban-testnet.stellar.org' 
      : 'https://soroban.stellar.org'
  );

  // Initialize admin keypair and address
  adminKeypair = Keypair.fromSecret(process.env.ADMIN_SECRET_KEY);
  adminAddress = new Address(adminKeypair.publicKey());

  // Initialize contract client
  contract = new Contract(process.env.CONTRACT_ID);
  
  console.log('Soroban configuration initialized');
}

export async function deployContract(feePercentage: number = 0, feeAddress?: string) {
  try {
    // Read contract WASM file
    const contractPath = path.resolve(__dirname, '../../contracts/batch_payment_contract.wasm');
    const contractWASM = readFileSync(contractPath);
    
    // Deploy contract WASM
    const account = await server.getAccount(adminAddress.toString());
    const uploadTx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase
    })
    .addOperation(Operation.invokeHostFunction({
      func: xdr.HostFunction.hostFunctionTypeUploadContractWasm(Buffer.from(contractWASM)),
      auth: []
    }))
    .setTimeout(TimeoutInfinite)
    .build();

    uploadTx.sign(adminKeypair);
    const uploadResult = await server.sendTransaction(uploadTx);
    const wasmId = uploadResult.hash;
    
    // Initialize the contract
    const contract = new Contract(wasmId);
    
    // Get account details
    const accountDetails = await server.getAccount(adminAddress.toString());
    
    const tx = new TransactionBuilder(accountDetails, {
      fee: BASE_FEE,
      networkPassphrase
    })
    .addOperation(contract.call(
      'initialize',
      nativeToScVal(feePercentage),
      feeAddress ? new Address(feeAddress).toScVal() : xdr.ScVal.scvVoid()
    ))
    .setTimeout(TimeoutInfinite)
    .build();

    // Sign and submit transaction
    tx.sign(adminKeypair);
    const result = await server.sendTransaction(tx);
    
    return {
      contractId: wasmId,
      hash: result.hash
    };
  } catch (error) {
    console.error('Error deploying contract:', error);
    throw error;
  }
}  