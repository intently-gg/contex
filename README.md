# contex - Contract Explorer

A lightweight, single-page React admin dashboard for exploring and interacting with smart contracts. Built with Vite, Tailwind CSS, Shadcn/UI, Wagmi/Viem, and RainbowKit.

## Features

- **ABI Management**: Drop ABI JSON files in the `abis/` folder or add them via the UI
- **Contract Registry**: Manage contracts with nested structure (ABI > Addresses > ChainIds)
- **Dynamic UI Generation**: Automatically generates read/write function interfaces from ABIs
- **Multi-Chain Support**: Switch between EVM chains with chain-aware contract filtering
- **Function Search**: Global search across all functions
- **Favorites**: Pin frequently used functions
- **Dark/Light Mode**: Theme toggle in the header
- **State Persistence**: Form inputs and read results persist across tab/chain switches

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Create a `.env` file (optional):
```env
VITE_PORT=3000
VITE_DEFAULT_CHAIN_ID=1
```

3. Add your WalletConnect project ID to `src/lib/wagmi.ts`:
```typescript
projectId: "YOUR_PROJECT_ID", // Replace with your WalletConnect project ID
```

4. Start the dev server:
```bash
pnpm dev
```

The app will run on `http://localhost:3000` (or the port specified in `.env`).

## Usage

1. **Add ABIs**: 
   - Drop `.json` files in the `abis/` folder, or
   - Use the "Manage ABIs" button to add/edit/delete ABIs via copy/paste

2. **Register Contracts**:
   - Click "Add Contract"
   - Select an ABI file
   - Enter contract address and label
   - Select supported chains

3. **Interact with Contracts**:
   - Navigate between contracts using tabs
   - Select addresses for each contract
   - Read functions auto-refresh, write functions require execution
   - Use the search bar to find functions quickly
   - Pin favorite functions for easy access

## Project Structure

```
src/
  components/
    ui/              # Shadcn components
    contract/        # Contract-specific components
    layout/          # Layout components
  hooks/             # Custom Wagmi hooks
  lib/               # Utilities (ABI parsing, form generation, etc.)
  stores/            # Zustand state management
  types/             # TypeScript definitions
abis/                # ABI JSON files folder
public/
  contracts.json     # Contract registry
```

## Configuration

- **Port**: Set `VITE_PORT` in `.env` (default: 3000)
- **Chains**: Modify `src/lib/wagmi.ts` to add/remove chains
- **Theme**: Toggle in header (persists in localStorage)

## Notes

- The app uses Zustand with persist middleware for state management
- ABI files are watched via a custom Vite plugin
- Contract registry is stored in `public/contracts.json`
- Form state is shared by ABI (not address/chain specific)
- Read results are cached per contract/chain/function/address combination
