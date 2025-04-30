import express from 'express';
import { deployContract } from '../services/soroban';
import { SorobanRpc, Address, Contract, Networks, TransactionBuilder, 
  BASE_FEE, TimeoutInfinite } from 'stellar-sdk';
import { Keypair } from 'stellar-sdk';
import { xdr } from 'stellar-sdk';

const router = express.Router();

// Middleware para verificar si es administrador (para usar en rutas protegidas)
const isAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Aquí implementarías lógica de verificación de administrador
  // Podría ser mediante tokens JWT, comparación de claves públicas, etc.
  
  // Ejemplo simple:
  const adminPublicKey = process.env.ADMIN_PUBLIC_KEY;
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }
  
  // En un sistema real, verificarías un JWT firmado correctamente
  // Por ahora, simplemente dejaremos pasar cualquier solicitud con un token
  next();
};

// Ruta para desplegar un nuevo contrato
router.post('/deploy-contract', isAdmin, async (req, res) => {
  try {
    const { feePercentage } = req.body;
    const feeAddress = req.body.feeAddress || process.env.FEE_ADDRESS;
    
    // Llamar al servicio para desplegar el contrato
    const result = await deployContract(feePercentage || 0, feeAddress);
    
    res.json({
      success: true,
      contractId: result.contractId,
      txHash: result.hash,
      message: 'Contract deployed successfully'
    });
  } catch (error: any) {
    console.error('Error deploying contract:', error);
    res.status(500).json({ 
      error: 'Failed to deploy contract',
      message: error.message
    });
  }
});

// Ruta para actualizar la configuración de administrador
router.put('/settings', isAdmin, async (req, res) => {
  try {
    const { newAdmin, newFeeAddress, newFeePercentage } = req.body;
    
    // Obtener las variables necesarias del servicio Soroban
    const adminKeypair = Keypair.fromSecret(process.env.ADMIN_SECRET_KEY!);
    const adminAddress = new Address(adminKeypair.publicKey());
    const networkPassphrase = process.env.NETWORK === 'TESTNET' ? Networks.TESTNET : Networks.PUBLIC;
    const contract = new Contract(process.env.CONTRACT_ID!);
    const server = new SorobanRpc.Server(
      process.env.NETWORK === 'TESTNET'
        ? 'https://soroban-testnet.stellar.org'
        : 'https://soroban.stellar.org'
    );
    
    // Get account details
    const account = await server.getAccount(adminAddress.toString());
    
    // Construir y enviar la transacción
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase
    })
    .addOperation(contract.call(
      'update_admin_settings',
      adminAddress.toScVal(),
      newAdmin ? new Address(newAdmin).toScVal() : xdr.ScVal.scvVoid(),
      newFeeAddress ? new Address(newFeeAddress).toScVal() : xdr.ScVal.scvVoid(),
      newFeePercentage !== undefined ? xdr.ScVal.scvU32(newFeePercentage) : xdr.ScVal.scvVoid()
    ))
    .setTimeout(TimeoutInfinite)
    .build();
    
    // Firmar la transacción
    tx.sign(adminKeypair);
    
    // Enviar la transacción
    const result = await server.sendTransaction(tx);
    
    if (result.status !== 'ERROR') {
      res.json({ 
        status: result.status,
        hash: result.hash,
        message: 'Admin settings updated successfully'
      });
    } else {
      res.status(400).json({ 
        error: 'Failed to update admin settings',
        status: result.status,
        errorInfo: result.errorResult
      });
    }
  } catch (error: any) {
    console.error('Error updating admin settings:', error);
    res.status(500).json({ 
      error: 'Failed to update admin settings',
      message: error.message 
    });
  }
});

// Ruta para obtener estadísticas administrativas
router.get('/stats', isAdmin, async (req, res) => {
  try {
    // Aquí implementarías lógica para obtener estadísticas
    // Por ejemplo, número total de pagos, volumen total, etc.
    
    // Ejemplo de respuesta
    res.json({
      totalClaims: 0,
      pendingClaims: 0,
      processedClaims: 0,
      failedClaims: 0,
      totalVolume: 0
    });
  } catch (error: any) {
    console.error('Error getting admin stats:', error);
    res.status(500).json({ 
      error: 'Failed to get admin statistics',
      message: error.message 
    });
  }
});

export default router;