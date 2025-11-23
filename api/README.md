# Budget API

A Fastify-based REST API for the budget application with PostgreSQL database and JWT authentication.

## Project Structure

```
api/
├── .env.example          # Template for environment variables
├── .gitignore            # Protects .env and node_modules
├── package.json
└── src/
    ├── server.js         # Main entry point
    ├── config.js         # Environment & encrypted secrets handling
    ├── plugins/
    │   ├── postgres.js   # Database connection
    │   └── jwt.js        # JWT authentication
    ├── routes/
    │   ├── users.js      # User registration, login, profile
    │   ├── templates.js  # Budget template management
    │   ├── sheets.js     # Budget sheet management
    │   └── purchases.js  # Purchase tracking and linking
    └── utils/
        └── encrypt-secret.js  # CLI tool to encrypt passwords
```

## API Endpoints

### Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/users/register` | Create account | No |
| POST | `/api/users/login` | Login, get JWT | No |
| GET | `/api/users/me` | Get profile | Yes |

### Budget Templates

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/templates` | Get all templates | Yes |
| GET | `/api/templates?id={uuid}` | Get template with groups and items | Yes |
| GET | `/api/templates/default` | Get user's default template with groups and items | Yes |
| POST | `/api/templates` | Create new template | Yes |
| POST | `/api/templates/:templateId/groups` | Add group to template | Yes |
| PUT | `/api/templates/:templateId/groups/:groupId` | Update group | Yes |
| POST | `/api/templates/:templateId/groups/:groupId/items` | Add line item to group | Yes |
| PUT | `/api/templates/:templateId/groups/:groupId/items/:itemId` | Update line item | Yes |
| DELETE | `/api/templates/:templateId/groups/:groupId/items/:itemId` | Remove line item | Yes |
| DELETE | `/api/templates/:templateId/groups/:groupId` | Remove group | Yes |
| DELETE | `/api/templates/:templateId` | Delete template | Yes |

### Budget Sheets

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/sheets` | List all budget sheets | Yes |
| GET | `/api/sheets/current` | Get current month's budget | Yes |
| GET | `/api/sheets/:year/:month` | Get budget by year/month | Yes |
| GET | `/api/sheets/:sheetId` | Get budget by ID | Yes |
| POST | `/api/sheets` | Create budget from template | Yes |
| GET | `/api/sheets/:sheetId/sync-status` | Check if budget is synced with template | Yes |
| POST | `/api/sheets/:sheetId/sync` | Sync budget with template changes | Yes |

### Purchases

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/purchases` | Create a new purchase | Yes |
| GET | `/api/purchases/unassociated` | Get all unassociated purchases | Yes |
| GET | `/api/purchases/line-item/:lineItemId` | Get purchases for a line item | Yes |
| PATCH | `/api/purchases/:purchaseId/link` | Link purchase to line item | Yes |
| PATCH | `/api/purchases/:purchaseId/unlink` | Unlink purchase from line item | Yes |

### Health

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/health` | Health check | No |

## Getting Started

```bash
cd api
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your database credentials
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `HOST` | Server host | `0.0.0.0` |
| `DATABASE_URL` | Full connection string (optional) | - |
| `DATABASE_HOST` | Database host | `localhost` |
| `DATABASE_PORT` | Database port | `5432` |
| `DATABASE_NAME` | Database name | `budget` |
| `DATABASE_USER` | Database user | `postgres` |
| `DATABASE_PASSWORD` | Plain text password (local dev) | - |
| `DATABASE_PASSWORD_ENCRYPTED` | Encrypted password (production) | - |
| `ENCRYPTION_KEY` | Key to decrypt password | - |
| `JWT_SECRET` | Secret for signing JWTs | - |
| `JWT_EXPIRES_IN` | Token expiration | `24h` |

### Password Encryption for Production

For non-local environments, encrypt your database password to avoid storing plain text in configuration:

```bash
npm run encrypt-secret
# Enter your password and encryption key
# Copy the output to DATABASE_PASSWORD_ENCRYPTED in .env
# Set ENCRYPTION_KEY in your deployment environment
```

## Running the Server

```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

## Example Usage

### Register a New User

```bash
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "securepass123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

Response:
```json
{
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Login

```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "securepass123"
  }'
```

Response:
```json
{
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Get User Profile (Protected)

```bash
curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer <your-jwt-token>"
```

Response:
```json
{
  "id": "uuid",
  "email": "test@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Create a Budget Template

```bash
curl -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "name": "Monthly Budget",
    "description": "Standard monthly budget template",
    "baseIncome": 5000,
    "isDefault": true
  }'
```

Response:
```json
{
  "id": "uuid",
  "name": "Monthly Budget",
  "description": "Standard monthly budget template",
  "baseIncome": "5000",
  "isDefault": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Add a Group to Template

```bash
curl -X POST http://localhost:3000/api/templates/<template-id>/groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "name": "Housing",
    "description": "Housing expenses"
  }'
```

Response:
```json
{
  "id": "uuid",
  "name": "Housing",
  "description": "Housing expenses",
  "sortOrder": 0,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Update a Group

```bash
curl -X PUT http://localhost:3000/api/templates/<template-id>/groups/<group-id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "name": "Housing & Utilities",
    "description": "Housing and utility expenses",
    "sortOrder": 1
  }'
```

Response:
```json
{
  "id": "uuid",
  "name": "Housing & Utilities",
  "description": "Housing and utility expenses",
  "sortOrder": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

Note: All fields are optional in the request body. Only the fields provided will be updated.

### Add a Line Item to Group

```bash
curl -X POST http://localhost:3000/api/templates/<template-id>/groups/<group-id>/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "name": "Rent",
    "budgetedAmount": 1500,
    "isRollover": false
  }'
```

Response:
```json
{
  "id": "uuid",
  "name": "Rent",
  "description": null,
  "budgetedAmount": "1500",
  "isRollover": false,
  "sortOrder": 0,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Update a Line Item

```bash
curl -X PUT http://localhost:3000/api/templates/<template-id>/groups/<group-id>/items/<item-id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "name": "Mortgage",
    "budgetedAmount": 1800,
    "isRollover": true
  }'
```

Response:
```json
{
  "id": "uuid",
  "name": "Mortgage",
  "description": null,
  "budgetedAmount": "1800",
  "isRollover": true,
  "sortOrder": 0,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

Note: All fields are optional in the request body. Only the fields provided will be updated.

### Get Template with All Groups and Items

```bash
curl "http://localhost:3000/api/templates?id=<template-id>" \
  -H "Authorization: Bearer <your-jwt-token>"
```

Response:
```json
{
  "id": "uuid",
  "name": "Monthly Budget",
  "description": "Standard monthly budget template",
  "baseIncome": "5000",
  "isDefault": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "groups": [
    {
      "id": "uuid",
      "name": "Housing",
      "description": "Housing expenses",
      "sortOrder": 0,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "lineItems": [
        {
          "id": "uuid",
          "name": "Rent",
          "description": null,
          "budgetedAmount": "1500",
          "isRollover": false,
          "sortOrder": 0,
          "createdAt": "2024-01-01T00:00:00.000Z",
          "updatedAt": "2024-01-01T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

### Get Default Template

```bash
curl http://localhost:3000/api/templates/default \
  -H "Authorization: Bearer <your-jwt-token>"
```

Response: Returns the user's default template with all groups and line items (same structure as "Get Template with All Groups and Items"). Returns 404 if no default template is set.

### Delete a Template

```bash
curl -X DELETE http://localhost:3000/api/templates/<template-id> \
  -H "Authorization: Bearer <your-jwt-token>"
```

Response: Returns 204 No Content on success.

### Create a Budget Sheet from Template

```bash
curl -X POST http://localhost:3000/api/sheets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "templateId": "<template-id>",
    "year": 2025,
    "month": 11,
    "additionalIncome": 500,
    "carryOverRollovers": true
  }'
```

This creates a budget sheet for November 2025 using the specified template. The `carryOverRollovers` option (default: true) automatically carries over rollover amounts from the previous month's sheet.

Response:
```json
{
  "id": "uuid",
  "templateId": "uuid",
  "name": "Monthly Budget",
  "description": "Standard monthly budget template",
  "year": 2025,
  "month": 11,
  "baseIncome": "5000",
  "additionalIncome": "500",
  "rolledOverIncome": "0",
  "totalIncome": "5500",
  "totalBudgeted": "1500",
  "totalActual": "0",
  "budgetedRemaining": "4000",
  "actualRemaining": "5500",
  "isFinalized": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "groups": [
    {
      "id": "uuid",
      "templateGroupId": "uuid",
      "name": "Housing",
      "description": "Housing expenses",
      "sortOrder": 0,
      "totalBudgeted": 1500,
      "totalActual": 0,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "lineItems": [
        {
          "id": "uuid",
          "templateLineItemId": "uuid",
          "name": "Rent",
          "description": null,
          "budgetedAmount": "1500",
          "actualAmount": "0",
          "isRollover": false,
          "rolledOverAmount": "0",
          "availableBalance": null,
          "sortOrder": 0,
          "createdAt": "2024-01-01T00:00:00.000Z",
          "updatedAt": "2024-01-01T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

### Get Current Month's Budget

```bash
curl http://localhost:3000/api/sheets/current \
  -H "Authorization: Bearer <your-jwt-token>"
```

Response: Returns the full budget sheet with groups and line items (same structure as "Create a Budget Sheet from Template").

### Get Budget for Specific Month

```bash
curl http://localhost:3000/api/sheets/2025/11 \
  -H "Authorization: Bearer <your-jwt-token>"
```

Response: Returns the full budget sheet with groups and line items (same structure as "Create a Budget Sheet from Template").

### List All Budget Sheets

```bash
curl http://localhost:3000/api/sheets \
  -H "Authorization: Bearer <your-jwt-token>"
```

Response:
```json
[
  {
    "id": "uuid",
    "name": "Monthly Budget",
    "description": "Standard monthly budget template",
    "year": 2025,
    "month": 11,
    "baseIncome": "5000",
    "additionalIncome": "500",
    "rolledOverIncome": "0",
    "totalIncome": 5500,
    "totalBudgeted": "1500",
    "totalActual": "0",
    "budgetedRemaining": "4000",
    "actualRemaining": "5500",
    "isFinalized": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Check Budget Sheet Sync Status

```bash
curl http://localhost:3000/api/sheets/<sheet-id>/sync-status \
  -H "Authorization: Bearer <your-jwt-token>"
```

Checks if a budget sheet is up-to-date with its template by comparing timestamps. Returns `isSynced: true` if the sheet was last synced after the template was last updated.

Response:
```json
{
  "sheetId": "uuid",
  "templateId": "uuid",
  "sheetSyncedAt": "2024-01-15T10:00:00.000Z",
  "templateUpdatedAt": "2024-01-10T08:00:00.000Z",
  "isSynced": true
}
```

If `isSynced` is `false`, the template has been modified since the budget sheet was created, and you may want to call the sync endpoint to update the sheet.

### Sync Budget Sheet with Template

```bash
curl -X POST http://localhost:3000/api/sheets/<sheet-id>/sync \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "updateExisting": false
  }'
```

This syncs a budget sheet with changes made to its template. Use this when you've added new groups or line items to a template and want to update existing budgets built from that template.

Options:
- `updateExisting` (default: false) - If true, also updates names, descriptions, budgeted amounts, and sort orders of existing groups and line items to match the template. If false, only adds new groups and line items.

The endpoint preserves all existing data:
- `actual_amount` (sum of linked purchases) is never modified
- `rolled_over_amount` is never modified

Response:
```json
{
  "sheet": {
    "id": "uuid",
    "templateId": "uuid",
    "name": "Monthly Budget - 2025/11",
    "year": 2025,
    "month": 11,
    "groups": [
      {
        "id": "uuid",
        "name": "Housing",
        "lineItems": [...]
      },
      {
        "id": "uuid",
        "name": "Transportation",
        "lineItems": [...]
      }
    ]
  },
  "syncStats": {
    "groupsAdded": 1,
    "itemsAdded": 3,
    "groupsUpdated": 0,
    "itemsUpdated": 0
  }
}
```

The `syncStats` shows what was changed:
- `groupsAdded` - Number of new groups added from the template
- `itemsAdded` - Number of new line items added from the template
- `groupsUpdated` - Number of existing groups updated (only when `updateExisting: true`)
- `itemsUpdated` - Number of existing line items updated (only when `updateExisting: true`)

### Create a Purchase

```bash
curl -X POST http://localhost:3000/api/purchases \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "amount": 50.00,
    "description": "Grocery shopping",
    "paymentMethod": "credit_card",
    "merchant": "Whole Foods",
    "referenceNumber": "TXN123456",
    "purchaseDate": "2025-11-15",
    "lineItemId": "<line-item-id>"
  }'
```

Creates a new purchase. Required fields are `amount` and `purchaseDate`. The `lineItemId` is optional - if provided, the purchase will be associated with that line item and the line item's `actual_amount` will be automatically updated. If omitted, the purchase is created as unassociated.

Response:
```json
{
  "id": "uuid",
  "lineItemId": "uuid",
  "amount": "50.00",
  "description": "Grocery shopping",
  "paymentMethod": "credit_card",
  "merchant": "Whole Foods",
  "referenceNumber": "TXN123456",
  "purchaseDate": "2025-11-15",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Get Unassociated Purchases

```bash
curl http://localhost:3000/api/purchases/unassociated \
  -H "Authorization: Bearer <your-jwt-token>"
```

Response:
```json
[
  {
    "id": "uuid",
    "amount": "50.00",
    "description": "Grocery shopping",
    "paymentMethod": "credit_card",
    "merchant": "Whole Foods",
    "referenceNumber": "TXN123456",
    "purchaseDate": "2025-11-15",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Get Purchases for a Line Item

```bash
curl http://localhost:3000/api/purchases/line-item/<line-item-id> \
  -H "Authorization: Bearer <your-jwt-token>"
```

Response: Returns an array of purchases (same structure as "Get Unassociated Purchases").

### Link a Purchase to a Line Item

```bash
curl -X PATCH http://localhost:3000/api/purchases/<purchase-id>/link \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "lineItemId": "<line-item-id>"
  }'
```

This links a purchase to a budget line item. The line item's `actual_amount` is automatically updated by a database trigger.

Response:
```json
{
  "id": "uuid",
  "lineItemId": "uuid",
  "amount": "50.00",
  "description": "Grocery shopping",
  "paymentMethod": "credit_card",
  "merchant": "Whole Foods",
  "referenceNumber": "TXN123456",
  "purchaseDate": "2025-11-15",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Unlink a Purchase from a Line Item

```bash
curl -X PATCH http://localhost:3000/api/purchases/<purchase-id>/unlink \
  -H "Authorization: Bearer <your-jwt-token>"
```

This removes the association between a purchase and its line item, making the purchase unassociated again.

Response:
```json
{
  "id": "uuid",
  "lineItemId": null,
  "amount": "50.00",
  "description": "Grocery shopping",
  "paymentMethod": "credit_card",
  "merchant": "Whole Foods",
  "referenceNumber": "TXN123456",
  "purchaseDate": "2025-11-15",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Authentication

Protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

Tokens are returned from the `/api/users/register` and `/api/users/login` endpoints.
