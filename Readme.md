# Stellar Batch Payments

A streamlined web application for sending batch payments on the Stellar network, designed to simplify the process of distributing rewards, payments, or other transactions to multiple recipients simultaneously.

## 🌟 Features

- **Batch Payments**: Send transactions to multiple recipients in a single operation
- **Multiple Network Support**: Works on both Stellar Testnet and Mainnet
- **Wallet Integration**: Connect with popular Stellar wallets (Freighter & Albedo)
- **Batch Processing**: Handle large volumes of payments automatically split into optimal transaction sizes
- **Memo Support**: Add individual or batch memos to each transaction
- **Claims Management**: Track, filter, and process pending payment claims
- **Bulk Import/Export**: Import recipient lists from CSV files or export for record-keeping
- **Transaction Monitoring**: Real-time status updates for all transactions

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- A Stellar wallet (Freighter or Albedo)

### Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/stellar-batch-payments.git
cd stellar-batch-payments
```

2. Install dependencies

```bash
npm install
# or
yarn install
```

3. Start the development server

```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## 📚 Usage

1. **Connect Your Wallet**: Click on the Connect button to link your Stellar wallet
2. **Select Network**: Choose between Testnet (for testing) or Mainnet (for real transactions)
3. **Add Recipients**: Add recipients manually or import from a CSV file
4. **Review & Submit**: Verify transaction details and submit the batch payment
5. **Track Status**: Monitor transaction status and confirmations

### CSV Format

When importing recipients, use the following format:

```
destination_address,memo,amount,asset
GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN,Weekly reward,10.5,XLM
GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5,Contest winner,25,USDC
```

## 🔧 Technical Details

- Built with Next.js and React
- Uses Stellar SDK for blockchain interactions
- Implements ShadCN UI components for a modern interface
- Responsive design works on desktop and mobile

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📧 Contact

If you have any questions or feedback, please open an issue on this repository.