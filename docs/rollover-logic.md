# Budget Sheet Rollover Logic

## Overview

The system allows certain budget line items to accumulate balances that "roll over" from one month to the next, similar to savings envelopes or sinking funds.

## Key Components

### 1. Views for Tracking Balances

**`budget_sheet_totals`** (lines 2-19)
- Calculates total income including rolled-over income
- Shows budgeted vs actual spending
- Computes remaining balances

**`rollover_item_totals`** (lines 22-37)
- Tracks individual rollover line items
- Calculates the `available_balance` using the formula at line 33:
  ```sql
  available_balance = rolled_over_amount + budgeted_amount - actual_amount
  ```
  This represents money carried forward plus new budget minus actual spending.

### 2. Creating Budget Sheets

**`create_sheet_from_template()`** (lines 40-141)
- Creates a new month's budget from a template
- Accepts `p_rolled_over_income` parameter for income rollover
- Copies all groups and line items from the template
- Initially sets `rolled_over_amount` to `0.00` (line 133) - to be filled later

### 3. Carrying Over Balances

**`carry_over_rollover_amounts()`** (lines 144-197)

This is the core rollover logic:

1. **Finds previous month's sheet** (lines 156-179)
   - Handles year boundaries (December → January)
   - Returns early if no previous sheet exists

2. **Updates rollover amounts** (lines 182-195)
   - Matches line items via `template_line_item_id` (ensures "Car Savings" in March connects to "Car Savings" in February)
   - Only processes items where `is_rollover = true`
   - Calculates the rollover using the formula at line 184:
     ```sql
     rolled_over_amount = previous.rolled_over_amount + previous.budgeted_amount - previous.actual_amount
     ```

## How It Works Together

1. Create a new budget sheet for March using `create_sheet_from_template()`
2. Call `carry_over_rollover_amounts()` to pull balances from February
3. Any rollover item that had money left over (budgeted more than spent) carries that surplus forward
4. Any rollover item that overspent (actual > budget) carries that deficit forward as a negative amount

This allows you to build up savings categories over time or track when you've dipped into funds from previous months.

## Source

This documentation is based on the SQL file: `database/006_create_views_and_functions.sql`
