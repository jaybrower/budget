# Plaid Integration Implementation Plan

## Overview

This document outlines the implementation plan for integrating Plaid into the Budget application to enable automatic import of credit card transactions.

---

## Phase 1: Setup & Configuration

### 1.1 Plaid Account Setup
- Create account at [dashboard.plaid.com](https://dashboard.plaid.com)
- Get credentials: `client_id`, `secret` for sandbox/development/production
- Note: Start with **Sandbox** environment for testing

### 1.2 Environment Configuration
Add to `api/.env`:
```
PLAID_CLIENT_ID=your_client_id
PLAID_SECRET=your_secret
PLAID_ENV=sandbox
PLAID_PRODUCTS=transactions
PLAID_COUNTRY_CODES=US
```

---

## Phase 2: Database Schema Changes

### 2.1 Create `plaid_items` table
Store linked accounts (institutions).

```sql
CREATE TABLE plaid_items (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,  -- Encrypted Plaid access token
    item_id VARCHAR(255) NOT NULL,  -- Plaid's item identifier
    institution_id VARCHAR(255),
    institution_name VARCHAR(255),
    cursor TEXT,  -- For transaction sync pagination
    last_synced_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, item_id)
);
```

### 2.2 Create `plaid_accounts` table
Individual accounts within an item.

```sql
CREATE TABLE plaid_accounts (
    id UUID PRIMARY KEY,
    plaid_item_id UUID NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
    account_id VARCHAR(255) NOT NULL,  -- Plaid's account ID
    name VARCHAR(255),
    official_name VARCHAR(255),
    type VARCHAR(50),  -- credit, depository, etc.
    subtype VARCHAR(50),  -- credit card, checking, etc.
    mask VARCHAR(10),  -- Last 4 digits
    payment_method VARCHAR(50),  -- Maps to your existing payment_method field
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(plaid_item_id, account_id)
);
```

### 2.3 Add Plaid tracking to purchases table

```sql
ALTER TABLE purchases ADD COLUMN plaid_transaction_id VARCHAR(255);
ALTER TABLE purchases ADD COLUMN plaid_account_id UUID REFERENCES plaid_accounts(id);
CREATE UNIQUE INDEX idx_purchases_plaid_transaction_id ON purchases(plaid_transaction_id) WHERE plaid_transaction_id IS NOT NULL;
```

---

## Phase 3: Backend API Implementation

### 3.1 Install dependencies

```bash
cd api
npm install plaid
```

### 3.2 Create Plaid plugin
Location: `api/src/plugins/plaid.js`

- Initialize Plaid client with configuration
- Register as Fastify plugin for dependency injection

### 3.3 Create Plaid routes
Location: `api/src/routes/plaid.js`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/plaid/link-token` | POST | Generate link token to initialize Plaid Link |
| `/api/plaid/exchange-token` | POST | Exchange public token for access token after user links account |
| `/api/plaid/items` | GET | Get user's linked institutions |
| `/api/plaid/items/:itemId` | DELETE | Unlink an institution |
| `/api/plaid/accounts` | GET | Get all linked accounts with balances |
| `/api/plaid/accounts/:accountId` | PATCH | Update account settings (payment_method mapping) |
| `/api/plaid/sync` | POST | Sync transactions from all linked accounts |
| `/api/plaid/webhook` | POST | Handle Plaid webhooks for real-time updates |

### Key Implementation Details

#### Link Token Creation
Called when user wants to connect a bank.

```javascript
async function createLinkToken(request, reply) {
  const linkTokenResponse = await plaidClient.linkTokenCreate({
    user: { client_user_id: request.user.userId },
    client_name: 'Budget App',
    products: ['transactions'],
    country_codes: ['US'],
    language: 'en',
  });
  return { link_token: linkTokenResponse.data.link_token };
}
```

#### Token Exchange
Called after successful Plaid Link.

```javascript
async function exchangePublicToken(request, reply) {
  const { public_token, metadata } = request.body;

  // Exchange for access token
  const exchangeResponse = await plaidClient.itemPublicTokenExchange({
    public_token,
  });

  // Encrypt and store access token
  // Store institution info and accounts
  // Initial transaction sync
}
```

#### Transaction Sync
Uses Plaid's sync endpoint.

```javascript
async function syncTransactions(request, reply) {
  // For each plaid_item:
  //   1. Call transactionsSync with cursor
  //   2. Process added/modified/removed transactions
  //   3. Create/update purchases with plaid_transaction_id
  //   4. Update cursor for next sync
}
```

---

## Phase 4: Frontend Implementation

### 4.1 Install Plaid Link

```bash
cd ui
npm install react-plaid-link
```

### 4.2 Create API module
Location: `ui/src/api/plaid.ts`

```typescript
export async function createLinkToken(): Promise<{ link_token: string }>;
export async function exchangePublicToken(publicToken: string, metadata: any): Promise<void>;
export async function getPlaidItems(): Promise<PlaidItem[]>;
export async function getPlaidAccounts(): Promise<PlaidAccount[]>;
export async function updateAccountMapping(accountId: string, paymentMethod: string): Promise<void>;
export async function syncTransactions(): Promise<SyncResult>;
export async function unlinkItem(itemId: string): Promise<void>;
```

### 4.3 Create types
Location: `ui/src/types/plaid.ts`

```typescript
interface PlaidItem {
  id: string;
  institutionName: string;
  lastSyncedAt: string;
  accounts: PlaidAccount[];
}

interface PlaidAccount {
  id: string;
  name: string;
  officialName: string;
  type: string;
  subtype: string;
  mask: string;
  paymentMethod: string | null;
}

interface SyncResult {
  added: number;
  modified: number;
  removed: number;
}
```

### 4.4 Create LinkedAccounts page
Location: `ui/src/pages/LinkedAccounts.tsx`

Features:
- Display linked institutions and accounts
- "Link New Account" button → Opens Plaid Link
- Account list with payment method mapping dropdowns
- "Sync Transactions" button
- "Unlink" button per institution

### 4.5 Update navigation
Add "Linked Accounts" to `Layout.tsx`

### 4.6 Plaid Link component integration

```typescript
import { usePlaidLink } from 'react-plaid-link';

function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  useEffect(() => {
    createLinkToken().then(data => setLinkToken(data.link_token));
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token, metadata) => {
      exchangePublicToken(public_token, metadata).then(() => {
        // Refresh accounts list
      });
    },
  });

  return (
    <button onClick={() => open()} disabled={!ready}>
      Link Bank Account
    </button>
  );
}
```

---

## Phase 5: Transaction Processing Logic

### 5.1 Mapping Plaid transactions to purchases

```javascript
function mapPlaidTransactionToPurchase(transaction, account) {
  return {
    user_id: account.user_id,
    amount: Math.abs(transaction.amount), // Plaid uses negative for debits
    description: transaction.name,
    merchant: transaction.merchant_name || transaction.name,
    payment_method: account.payment_method,
    purchase_date: transaction.date,
    plaid_transaction_id: transaction.transaction_id,
    plaid_account_id: account.id,
    reference_number: transaction.transaction_id,
    // line_item_id: null (unassociated, user categorizes later)
  };
}
```

### 5.2 Deduplication strategy
- Use `plaid_transaction_id` unique index to prevent duplicates
- Handle modified transactions by updating existing purchases
- Handle removed transactions (Plaid can remove pending transactions)

### 5.3 Transaction categorization (future enhancement)
- Plaid provides `category` field (e.g., "Food and Drink > Restaurants")
- Could auto-suggest line item mappings based on category
- Could learn from user's previous categorizations

---

## Phase 6: Security Considerations

### 6.1 Access token storage
- Encrypt access tokens using existing AES-256-GCM encryption
- Never expose access tokens to frontend
- Store in `plaid_items` table, encrypted

### 6.2 Webhook verification
- Verify webhook signatures from Plaid
- Use separate webhook endpoint with Plaid verification

### 6.3 Token refresh
- Handle `ITEM_LOGIN_REQUIRED` errors
- Implement update mode for Plaid Link to refresh credentials

---

## Phase 7: Webhooks (Optional but Recommended)

### 7.1 Set up webhook endpoint
- `POST /api/plaid/webhook`
- Verify Plaid signature
- Handle transaction updates in real-time

### 7.2 Key webhook events
- `TRANSACTIONS_SYNC_UPDATES_AVAILABLE` - New transactions ready
- `ITEM_ERROR` - Connection issues
- `ITEM_LOGIN_REQUIRED` - User needs to re-authenticate

---

## Implementation Order

| Phase | Task | Estimated Effort |
|-------|------|------------------|
| 1 | Database migrations (Phase 2) | ~30 min |
| 2 | Plaid plugin & config (Phase 3.1-3.2) | ~30 min |
| 3 | Link token & exchange endpoints (Phase 3.3) | ~2 hours |
| 4 | Frontend Plaid Link integration (Phase 4) | ~2 hours |
| 5 | Transaction sync endpoint (Phase 3.3 + 5) | ~3 hours |
| 6 | Linked Accounts page (Phase 4.4) | ~2 hours |
| 7 | Testing with Sandbox | ~2 hours |
| 8 | Webhooks (Phase 7) | ~2 hours |

---

## Testing Strategy

### Sandbox testing
- Use Plaid Sandbox credentials
- Test institutions: Use `user_good` / `pass_good` for successful auth
- Plaid provides test data automatically

### Test scenarios
1. Link new account successfully
2. Handle link failures/cancellations
3. Sync transactions
4. Handle duplicate sync attempts
5. Unlink account
6. Map accounts to payment methods
7. Verify purchases appear in Purchases page

---

## Cost Considerations

### Plaid Pricing (approximate)
- **Development**: Free (limited to 100 items)
- **Production**: Per-item fees vary by product
- **Transactions**: Typically $0.30-$1.00 per connected account/month

---

## Architecture Compatibility

The existing Budget app architecture is well-suited for this integration:

### Existing infrastructure that supports Plaid
- **Unassociated Purchases**: Already supports `line_item_id IS NULL` for imported transactions
- **Payment Method Field**: Ready for institution/account mapping
- **Auto-calculation Triggers**: Database updates `actual_amount` when purchases are linked
- **User Isolation**: Strong multi-tenant architecture
- **Encryption**: Existing AES-256-GCM for secrets
- **Config System**: Easy to add Plaid environment variables

### Files to modify
- `api/src/server.js` - Register Plaid routes
- `api/src/config.js` - Add Plaid configuration
- `ui/src/App.tsx` - Add LinkedAccounts route
- `ui/src/components/Layout.tsx` - Add navigation link

### New files to create
- `database/008_create_plaid_tables.sql`
- `api/src/plugins/plaid.js`
- `api/src/routes/plaid.js`
- `ui/src/api/plaid.ts`
- `ui/src/types/plaid.ts`
- `ui/src/pages/LinkedAccounts.tsx`

---

## Resources

- [Plaid Documentation](https://plaid.com/docs/)
- [Plaid Quickstart](https://plaid.com/docs/quickstart/)
- [React Plaid Link](https://github.com/plaid/react-plaid-link)
- [Plaid Transactions Sync](https://plaid.com/docs/api/products/transactions/#transactionssync)
