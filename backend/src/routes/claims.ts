import express from 'express';
import { 
  SorobanRpc, 
  Address, 
  Contract, 
  Networks, 
  TransactionBuilder, 
  BASE_FEE, 
  TimeoutInfinite, 
  xdr,
  nativeToScVal,
  scValToNative,
  ScInt
} from 'stellar-sdk';
import { Keypair } from 'stellar-sdk';

const router = express.Router();

// Environment variables
const CONTRACT_ID = process.env.CONTRACT_ID || '';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || '';
const NETWORK = process.env.NETWORK || 'TESTNET';

// Stellar initialization
const networkPassphrase = NETWORK === 'TESTNET' ? Networks.TESTNET : Networks.PUBLIC;
const server = new SorobanRpc.Server(
  NETWORK === 'TESTNET' 
    ? 'https://soroban-testnet.stellar.org' 
    : 'https://soroban.stellar.org'
);
const adminKeypair = Keypair.fromSecret(ADMIN_SECRET_KEY);
const adminAddress = Address.fromString(adminKeypair.publicKey());
const contract = new Contract(CONTRACT_ID);

interface Claim {
  id: string;
  destination: string;
  amount: string;
  asset: string;
  memo: string | null;
  status: string;
  created_at: string;
}

/**
 * GET /api/claims/:status
 * Get all claims by status
 * Possible states: "pending", "processed", "failed"
 */
router.get('/:status', async (req, res) => {
  try {
    const { status } = req.params;
    
    if (!['pending', 'processed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: pending, processed or failed' });
    }
    
    const account = await server.getAccount(adminAddress.toString());
    const result = await server.simulateTransaction(
      new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase
      })
      .addOperation(contract.call(
        'get_claims_by_status',
        xdr.ScVal.scvSymbol(status)
      ))
      .setTimeout(TimeoutInfinite)
      .build()
    );
    
    if ('result' in result && result.result?.retval) {
      const claims = parseScValToClaims(result.result.retval);
      res.json({ claims });
    } else {
      res.json({ claims: [] });
    }
  } catch (error: any) {
    console.error('Error getting claims:', error);
    res.status(500).json({ 
      error: 'Error getting claims', 
      details: error.message 
    });
  }
});

/**
 * GET /api/claims/destination/:address
 * Get all claims for a specific address
 */
router.get('/destination/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address.startsWith('G') || address.length !== 56) {
      return res.status(400).json({ error: 'Invalid Stellar address' });
    }
    
    const account = await server.getAccount(adminAddress.toString());
    const result = await server.simulateTransaction(
      new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase
      })
      .addOperation(contract.call(
        'get_claims_by_destination',
        Address.fromString(address).toScVal()
      ))
      .setTimeout(TimeoutInfinite)
      .build()
    );
    
    if ('result' in result && result.result?.retval) {
      const claims = parseScValToClaims(result.result.retval);
      res.json({ claims });
    } else {
      res.json({ claims: [] });
    }
  } catch (error: any) {
    console.error('Error getting claims by destination:', error);
    res.status(500).json({ 
      error: 'Error getting claims by destination', 
      details: error.message 
    });
  }
});

/**
 * GET /api/claims/detail/:id
 * Get details of a specific claim by ID
 */
router.get('/detail/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const claimId = Buffer.from(id, 'hex');
    
    if (claimId.length !== 32) {
      return res.status(400).json({ error: 'Invalid claim ID' });
    }
    
    const account = await server.getAccount(adminAddress.toString());
    const result = await server.simulateTransaction(
      new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase
      })
      .addOperation(contract.call(
        'get_claim',
        xdr.ScVal.scvBytes(claimId)
      ))
      .setTimeout(TimeoutInfinite)
      .build()
    );
    
    if ('result' in result && result.result?.retval) {
      if (result.result.retval.switch().name === 'scvVoid') {
        return res.status(404).json({ error: 'Claim not found' });
      }
      
      const claim = parseScValToClaim(result.result.retval);
      res.json({ claim });
    } else {
      res.status(404).json({ error: 'Claim not found' });
    }
  } catch (error: any) {
    console.error('Error getting claim details:', error);
    res.status(500).json({ 
      error: 'Error getting claim details', 
      details: error.message 
    });
  }
});

/**
 * POST /api/claims
 * Create new batch payment claims
 */
router.post('/', async (req, res) => {
  try {
    const { destinations, amounts, asset, memos } = req.body;
    
    if (!destinations || !amounts || !asset) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['destinations', 'amounts', 'asset'] 
      });
    }
    
    if (!Array.isArray(destinations) || !Array.isArray(amounts)) {
      return res.status(400).json({ 
        error: 'Destinations and amounts must be arrays' 
      });
    }
    
    if (destinations.length !== amounts.length) {
      return res.status(400).json({ 
        error: 'Destinations and amounts arrays must have the same length' 
      });
    }
    
    const normalizedMemos = Array.isArray(memos) ? memos : destinations.map(() => null);
    
    const account = await server.getAccount(adminAddress.toString());
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase
    })
    .addOperation(contract.call(
      'create_claims',
      adminAddress.toScVal(),
      xdr.ScVal.scvVec(destinations.map(d => Address.fromString(d).toScVal())),
      xdr.ScVal.scvVec(amounts.map(a => nativeToScVal(new ScInt(a).toString()))),
      xdr.ScVal.scvBytes(Buffer.from(asset, 'hex')),
      xdr.ScVal.scvVec(normalizedMemos.map(m => m ? xdr.ScVal.scvString(m) : xdr.ScVal.scvVoid()))
    ))
    .setTimeout(TimeoutInfinite)
    .build();
    
    tx.sign(adminKeypair);
    
    const result = await server.sendTransaction(tx);
    
    if (result.status !== 'ERROR') {
      res.json({ 
        status: result.status,
        hash: result.hash,
        message: 'Claims created successfully'
      });
    } else {
      res.status(400).json({ 
        error: 'Error creating claims',
        status: result.status,
        errorInfo: result.errorResult
      });
    }
  } catch (error: any) {
    console.error('Error creating claims:', error);
    res.status(500).json({ 
      error: 'Error creating claims', 
      details: error.message 
    });
  }
});

/**
 * POST /api/claims/process
 * Process selected claims
 */
router.post('/process', async (req, res) => {
  try {
    const { claimIds } = req.body;
    
    if (!claimIds || !Array.isArray(claimIds) || claimIds.length === 0) {
      return res.status(400).json({ 
        error: 'Claim IDs are required as a non-empty array' 
      });
    }
    
    const formattedClaimIds = claimIds.map(id => {
      const buffer = Buffer.from(id, 'hex');
      return xdr.ScVal.scvBytes(buffer);
    });
    
    const account = await server.getAccount(adminAddress.toString());
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase
    })
    .addOperation(contract.call(
      'process_claims',
      adminAddress.toScVal(),
      xdr.ScVal.scvVec(formattedClaimIds)
    ))
    .setTimeout(TimeoutInfinite)
    .build();
    
    tx.sign(adminKeypair);
    
    const result = await server.sendTransaction(tx);
    
    if (result.status !== 'ERROR') {
      res.json({ 
        status: result.status,
        hash: result.hash,
        message: 'Claims processed successfully'
      });
    } else {
      res.status(400).json({ 
        error: 'Error processing claims',
        status: result.status,
        errorInfo: result.errorResult
      });
    }
  } catch (error: any) {
    console.error('Error processing claims:', error);
    res.status(500).json({ 
      error: 'Error processing claims', 
      details: error.message 
    });
  }
});

function parseScValToClaims(scVal: xdr.ScVal): Claim[] {
  try {
    const vec = scValToNative(scVal) as any[];
    return vec.map(claim => ({
      id: claim.id.toString('hex'),
      destination: claim.destination,
      amount: claim.amount.toString(),
      asset: claim.asset.toString('hex'),
      memo: claim.memo,
      status: claim.status,
      created_at: claim.created_at.toString()
    }));
  } catch (error) {
    console.error('Error parsing ScVal to claims:', error);
    return [];
  }
}

function parseScValToClaim(scVal: xdr.ScVal): Claim | null {
  try {
    const claim = scValToNative(scVal) as any;
    return {
      id: claim.id.toString('hex'),
      destination: claim.destination,
      amount: claim.amount.toString(),
      asset: claim.asset.toString('hex'),
      memo: claim.memo,
      status: claim.status,
      created_at: claim.created_at.toString()
    };
  } catch (error) {
    console.error('Error parsing ScVal to claim:', error);
    return null;
  }
}

export default router;