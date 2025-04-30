import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import claimsRouter from './routes/claims';
import adminRouter from './routes/admin';
import { initSorobanConfig } from './services/soroban';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));

// Initialize Soroban configuration
initSorobanConfig();

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    network: process.env.NETWORK || 'TESTNET',
    contractId: process.env.CONTRACT_ID
  });
});

app.use('/api/claims', claimsRouter);
app.use('/api/admin', adminRouter);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Network: ${process.env.NETWORK || 'TESTNET'}`);
  console.log(`Contract ID: ${process.env.CONTRACT_ID || 'Not configured'}`);
});