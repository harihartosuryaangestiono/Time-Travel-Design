# AUDIT - TimeTravelDesign Finance (Next.js 14 App Router ERP)

Root: `/Users/harihartosurya/Developer/PembukuanTTD` (the path given in the task, `/Users/harihartosurya/PembukuanTTD`, does not exist).

## HEADLINE

**The backend is largely real; the UI is largely a demo.** Two modules are complete and imported by ZERO pages:

- `src/lib/reports/reportService.ts` - real `getTrialBalanceData()`, `getIncomeStatementData()`, `getBalanceSheetData()`, `getCashFlowData()` querying `accounts`/`journal_lines`/`journal_entries` with `requireAuthUser()` org scoping.
- `src/app/actions/dashboardActions.ts` - real `getDashboardMetrics()`, `getRecentTransactions()`, `getProjectBudgetSummary()`, `getExpensesByCategory()`, `getIncomeVsExpense()`.

Verified by grep over `src/app` + `src/components`: no importers.

Instead all five `/reports/*` pages and the dashboard render hardcoded demo data. Every report page's "Apply Date Filter" / "Apply Period Filter" button does `setTimeout(400)` then `setData(defaultXxx)` - the date inputs have ZERO effect on output. Real report logic sits one import away, unused.

Pattern 2: most list pages `useState(defaultXxx)` and only replace it if the Supabase query returns >=1 row - so a new org with empty tables shows fabricated demo data (Rp 2,450,000,000 reserves, "PT Bali Resort Investama", "Rian Pratama", Oct-2024 invoices) indistinguishable from real. Error paths `console.warn("Using rich showcase ... dataset")`.

Pattern 3: the "real data" branches often fabricate fields instead of reading them - `spent_amount = contract_value * 0.55`, `total_billing = 250000000`, `category: "Procurement Partner"`, `employee: "Studio Staff"`, `project: "Project Milestone Billing"`. These feed KPI cards and read as real figures.

Pattern 4 (schema level): `cash_transfers` exists in the Prisma schema but is NEVER written anywhere in the app, and `cash_accounts` has no `current_balance` column. Treasury balances therefore structurally cannot move - every page showing "balance" is showing `opening_balance`.

## GLOBAL OBSERVATIONS

- Server components (only these): `src/app/layout.tsx`, `src/app/page.tsx`, the four 5-line wrappers (`dashboard/page.tsx`, `cash-advances/page.tsx`, `expenses/page.tsx`, `projects/page.tsx` - each `async` but fetch nothing), `setup-organization/actions.ts`, `api/auth/callback/route.ts`. EVERY other page in scope is `"use client"`.
- Server actions imported into client components: legal in Next 14 ("use server" files are importable from client components) and the calls do work. But the pages that import them mostly swallow the result and mutate local state anyway. `setupOrganization` (the only action file inside a page folder) is imported by the client page `setup-organization/page.tsx` - correct usage, no violation. No mis-import of a server action into a client component found.
- Direct DB access from client components: pervasive. 11 pages call `createClient()` from `@/lib/supabase/client` and query tables straight from the browser, bypassing the `requireAuthUser()` org-scoping pattern the server actions use.
- No `loading.tsx`, `error.tsx`, or `not-found.tsx` anywhere in `src/app` (verified: zero files). No route-level loading or error boundary for any page.
- No page-level `export const metadata` anywhere except the root layout.
- Middleware gaps: `middleware.ts` `protectedRoutes` omits `/cash-accounts`, `/transfers`, `/setup-organization` - those three are reachable unauthenticated (shell renders; data does not load). `/forgot-password` is listed in `authRoutes` but NO such page exists - the login page links to it (line 94) => 404.
- `(dashboard)/layout.tsx` performs NO auth check, contrary to `IMPLEMENTATION_STATUS.md` ("(dashboard)/layout.tsx (auth check)"). Protection is entirely via middleware.
- Type safety: `useState<any>` in `settings/organization/page.tsx` and `settings/users/page.tsx`; `catch (err: any)` in 8 files; `setTxFilter(f.id as any)` in DashboardContent.

---

# PER-PAGE BREAKDOWN

## `src/app/page.tsx` - `/`

- Server component (no "use client"). Static marketing landing page.
- DB: none. Contains a block explicitly commented "Sample Metrics Mockup Grid" with hardcoded `IDR 2,450,000,000`, `12 Projects`, `IDR 84,500,000`, `+28.4%`.
- CRUD: none. Filters: none.
- Notes: links to `/login` and `/register` (both exist). `new Date().getFullYear()` at build time.

## `src/app/layout.tsx` - root layout

- Server component. Inter font, viewport/metadata, inline SVG data-URI favicon.
- No DB, no interactivity. `lang="en"` on an Indonesian-language app. No `suppressHydrationWarning`.

## `src/app/(dashboard)/layout.tsx` - dashboard shell

- Client component. Sidebar + Header + `<main>` with responsive padding.
- DB: none. Auth check: none (see global). Error/loading state: none.
- CRUD: none. Filters: none.
- Bug: `collapsed ? "lg:pl-20" : "lg:pl-64"` assumes the Sidebar's collapsed width; a mismatch would misalign content (Sidebar is out of scope, so unverifiable). No org context passed to Sidebar/Header.

## `src/app/(auth)/login/page.tsx` - `/login`

- Client component. Calls `signIn(email, password)` server action from `@/lib/auth/actions`.
- DB: REAL (Supabase Auth + `profiles` + `organization_members` inside `signIn`). Redirects to `/setup-organization` on `needsSetup`, else `/dashboard`.
- CRUD: interactive login form, show/hide password, loading state, error banner. No filters.
- Bugs:
  - "Remember this browser session" checkbox (line 126) is uncontrolled, unnamed, and never read - non-functional.
  - `catch (err: any)` - `err.message` is undefined for non-Error throws.
  - Links to `/forgot-password` => 404, page does not exist.
  - `router.push("/dashboard"); router.refresh();` - refresh after push is redundant/ordering-fragile.

## `src/app/(auth)/register/page.tsx` - `/register`

- Client component. Calls `signUp(email, password, fullName, "")`.
- DB: REAL - creates Supabase Auth user + `profiles` row.
- CRUD: interactive full form, password confirm + length checks, success screen with 2s auto-redirect to `/login`. No filters.
- Bugs:
  - Password min-length (8) enforced CLIENT-SIDE only; `signUp` has no server-side validation.
  - `signUp` returns hardcoded Indonesian error strings ("Email sudah terdaftar", "Gagal membuat profil") - locale inconsistency with the English UI.
  - `setTimeout(() => router.push("/login"), 2000)` - timer not cleaned up on unmount.
  - `catch (err: any)`.
  - If Supabase email confirmation is on, `signUp` returns a user with no session but the profile insert still runs; no "check your email" state exists.
  - `organizationName` param is passed as `""` and is unused by the action.

## `src/app/(auth)/setup-organization/page.tsx` - `/setup-organization`

- Client component. Imports `setupOrganization` from `./actions` (correct usage of a "use server" file from a client component).
- DB: REAL.
- CRUD: interactive org name/address/phone/email form.
- Bugs:
  - Form is PREFILLED with the hardcoded string "Time Travel Design" (line 15) - every new org silently inherits the same legal name unless cleared.
  - `catch (err: any)`; `error.message` unguarded.
  - No transaction around the multi-step create. A mid-way failure (e.g. `createMany` on accounts) leaves a half-created org, and the `organization_members` check on line 27 then blocks retry with "An organization workspace already exists for this profile" => orphaned org, real bug.
  - `prisma.organizationMember.findFirst({ where: { profile_id: user.id } })` is NOT scoped by organization_id - a user with two org memberships is blocked from creating/joining a second.
  - `new PrismaClient()` at module scope (line 7) - no global singleton; can exhaust connections on dev hot reload.
  - Deliberately bypasses RLS ("Create organization with Prisma (bypasses RLS)"), so the app's RLS policies do not protect this path.

## `src/app/(auth)/setup-organization/actions.ts`

- "use server". The best-implemented file in scope. `setupOrganization` auth-guards via `supabase.auth.getUser()`, then creates `organization`, `organization_settings`, `profile` (upsert), `organization_member` (OWNER, approval_limit 100000000), 24 default chart-of-accounts rows via `createMany`, one `cash_account` (Petty Cash Float, opening_balance 0), and an `accounting_period` for the current year. Also upserts into Supabase `profiles` for RLS. Ends with `revalidatePath("/", "layout")`. Catches errors and returns `{ error }`.
- Residual issues: no transaction (above); no link between the created `cash_account` and GL accounts `1100`/`1110`/`1120` (the `cash_accounts` table has no `account_id`, so balances cannot roll up to the ledger); account code `1100` "Petty Cash & Studio Float" duplicates the cash account named "Primary Petty Cash Float".

## `src/app/api/auth/callback/route.ts` - `/api/auth/callback`

- Server route handler (GET). Exchanges `?code=` for a session, checks `profiles` and `organization_members`, inserts a profile if missing, redirects to `/setup-organization` if no membership, else to `?next=` (default `/dashboard`).
- DB: REAL. CRUD: read + one insert.
- Bugs:
  - OPEN REDIRECT: `next` is used in `NextResponse.redirect(`${origin}${next}`)` with NO allow-list. `next=//evil.com` is protocol-relative and will be followed. Must validate that `next` starts with a single `/`.
  - `.single()` on `organization_members` errors (not null) when a user has multiple memberships => `membership` is null => user is redirected to setup-organization even though they have an org.
  - Same `.single()` multi-row concern on `profiles`.
  - Route mismatch: `lib/auth/actions.ts` `resetPassword` redirects to `${NEXT_PUBLIC_APP_URL}/auth/callback/reset-password` - that route DOES NOT EXIST (this handler is at `/api/auth/callback`; no reset-password page or route handler exists anywhere).
  - Uses `exchangeCodeForSession` (PKCE) but the app's login flow is password-based (`signInWithPassword`), so this path is only reachable via email confirmation/OAuth.

## `src/app/(dashboard)/dashboard/page.tsx` + `DashboardContent.tsx` - `/dashboard`

- Wrapper: server component (5 lines, fetches nothing). Content: client component, 1097 lines.
- DB: PARTIAL, and the minority of what is displayed. `fetchDashboardData()` queries Supabase directly for `cash_accounts` (balance from `opening_balance`), an `expenses` count where `status='SUBMITTED'`, and the 6 most recent `expenses`. Everything else is the hardcoded `defaultMonthlyTrend`, `defaultExpenseCategories`, `defaultProjectBudgets`, `defaultRecentTransactions` (lines 78-215) and the hardcoded `metrics` state (lines 223-235).
- Hardcoded values never derived from any data: "Cash Runway 8.8 Months", "Quick Liquidity (QR) 3.4x", "Budget Adherence 93.8%", StatCard trends "+8.4% / +14.2% / -4.1% / +22.5%", "94% of monthly target achieved", "IDR 262 M / mo" average inflows, "IDR 163 M / mo" burn rate, "IDR 99 M / mo" average net profit, "Studio benchmark: 30%". These are static JSX literals.
- `projects` (Project Budget Pacing matrix) is NEVER fetched - 100% demo data even for a populated org. `trendData` and `expenseCategories` are never fetched either (`setExpenseCategories` is never called), so both headline charts are always the Oct-2024 demo set.
- CRUD: none. Read-only.
- Filters/search/sort/paging: period selector (`this_month` / `last_quarter` / `ytd`) is COSMETIC - `period` is in the `useEffect` deps and re-runs the fetch, but the fetch never reads `period`, so all three options produce identical data; labels are hardcoded to 2024. Chart view switch (flow/margin) works. Transaction filter pills work, but only "expense" ever matches - real rows are mapped with `type: "expense"` unconditionally (line 324), so "Inflows" and "Advances" always render empty for real data. Refresh button re-fetches. No sorting, no pagination.
- Bugs:
  - Cash balance = `opening_balance` sum - ignores `cash_transfers`, disbursements, settlements, `cash_payments`. "Total Liquidity & Treasury" is a static number that never moves.
  - `setMetrics` merges ONE real value (`totalCash`) into a state object whose other 9 fields stay hardcoded - the KPI strip mixes one real number with nine fake ones with no visual distinction.
  - If the org has zero cash accounts, `realAccounts.length > 0` is false, so the fake "BCA Corporate Checking / Mandiri Business Treasury / Studio Petty Cash Vault" render for a brand-new org.
  - `catch (e) { console.warn("Using enriched demonstration analytics dataset", e) }` swallows all errors - no user-visible error state.
  - `setTxFilter(f.id as any)`.
  - Unused imports (`Filter`, `Download`, `Sparkles`, `Layers`, `ArrowUpRight`, `Building2`).
  - `isLoading` is only used for the refresh spinner; there is no initial loading state or skeleton, so the demo numbers flash before real data arrives.

## `src/app/(dashboard)/approvals/page.tsx` - `/approvals`  **FAKE - highest-priority stub**

- Client component.
- DB: NONE. This page never touches the database. It imports `createClient` from `@/lib/supabase/client` and `useEffect` - BOTH ARE IMPORTED AND NEVER USED (dead imports, lint errors). The entire dataset is `defaultApprovals` (lines 36-81).
- CRUD: FAKE. `handleAction(id, action)` does `setTimeout(() => setApprovals(prev => prev.map(...)), 400)` - a 400ms timer that flips local React state. NOTHING is written to the DB. Clicking "Authorize" changes nothing permanently; a refresh reverts it.
- Meanwhile `src/app/actions/expenseActions.ts` DOES contain real `approveExpense(id, comments)` and `rejectExpense(id, reason)` that insert into the `approvals` table, enforce "cannot approve your own expense", and update `expenses.status`. The page ignores them entirely. The approval workflow is implemented server-side and stubbed in the UI.
- Filters: status tabs (Pending/Approved/Rejected) with counts - local state only. No search, no sort, no pagination.
- Bugs: `defaultApprovals` uses ids `app-1`..`app-4`; the `setTimeout` is never cleared; dead `useEffect`/`createClient` imports.

## `src/app/(dashboard)/cash-accounts/page.tsx` - `/cash-accounts`

- Client component.
- DB: PARTIAL. `fetchAccounts()` queries Supabase `cash_accounts` (org-scoped, `is_active=true`, ordered by `type`). Falls back to `defaultAccounts` (BCA Rp 342M / Mandiri Rp 218.5M / Vault Rp 24M) on error OR on an empty result, so an empty new org shows three fake bank accounts with real-looking balances. Catch message: "Using rich showcase accounts dataset".
- CRUD: REAL with caveats. `CashAccountModal` -> `createCashAccountRecord` / `updateCashAccountRecord` (server actions, correctly scoped by `user.organizationId`); delete -> `deleteCashAccountRecord`.
- Filters/search/sort/paging: NONE. No search, no sort, no pagination. Card grid ordered by `type` from the query.
- Bugs:
  - Delete swallows the error: `catch (err: any) { console.warn("Account delete server action fallback:", err.message) }` and the row is removed from local state REGARDLESS of whether the DB delete succeeded.
  - PHANTOM ID ON CREATE: `handleSaveAccount` branches on `saved.id`; on create the local id is `ca-${Date.now()}` while the DB row has a real uuid. `CashAccountModal` awaits the action but DISCARDS its return value, so the real id is thrown away. Editing that row calls `updateCashAccountRecord` with a non-existent id. The page never refetches after a mutation.
  - `balance` = `opening_balance` - the same never-moves bug as the dashboard (and the schema has no current-balance column, so this is structural).
  - `isLoading` is set but NEVER RENDERED - no spinner, no empty state, no error state.
  - Card styling branches on `acc.name.toLowerCase().includes("bca")` / `"mandiri"` - bank branding derived from the account NAME string; renaming an account silently changes its card colour.
  - `parseFloat(a.opening_balance || "0")` - no NaN guard.
  - No "deactivate" UI; `is_active=false` rows are invisible and delete is the only removal path, with no balance reconciliation check.

## `src/app/(dashboard)/cash-advances/page.tsx` + `CashAdvancesContent.tsx` - `/cash-advances`

- Wrapper: server component (fetches nothing). Content: client component, 475 lines.
- DB: PARTIAL. Queries Supabase `cash_advances` (org-scoped, ordered by date desc). Falls back to `defaultAdvances` (4 records, `CA-2024-0042` etc.). Employee is hardcoded to the literal string `"Operational Staff"` for EVERY real row (line 197) - the real `employee_id` is never resolved.
- CRUD: MOSTLY FAKE. `CashAdvanceModal` does NOT import `cashAdvanceActions` at all - its `handleSubmit` just calls `onSuccess(formData)` and `onClose()`. NOTHING is written to the DB. The button is even labelled "Disburse Cash Advance" while performing no disbursement. `handleDeleteAdvance` filters local state only.
  - `src/app/actions/cashAdvanceActions.ts` contains real `createCashAdvance`, `submitCashAdvance`, `approveCashAdvance`, `disburseCashAdvance` (finance-only, permission-checked), `settleCashAdvance` (inserts into `advance_settlements`) - and is ENTIRELY UNUSED by this page. There is also a `cash_advances` Prisma model and `advance_settlements` table that the UI never touches.
- Filters/search: text search over `number`/`purpose`/`employee` + status tabs (All/Disbursed/Partial/Settled). No sorting, no pagination.
- Bugs:
  - Status tabs omit `DRAFT` and `SUBMITTED` - those advances are reachable only under "All". (Prisma `CashAdvanceStatus` also has `REJECTED` and `CANCELLED`, likewise unreachable.)
  - `totalOutstanding` counts only `DISBURSED`/`PARTIALLY_SETTLED`; a `SUBMITTED` advance contributes 0 despite being unpaid.
  - "Settlement Velocity 94.2%" is a hardcoded literal, not computed.
  - The "Open Balance" column is declared in the table header and `remaining` is computed in the row body, but THE CELL IS NEVER RENDERED - a missing column.
  - New-advance default in the modal hardcodes `employee: "Rian Pratama (Lead Architect)"` - creating an advance silently attributes it to a real-looking staff member.
  - `useState(defaultAdvances)` + `if (data && data.length > 0)` => empty org shows demo advances.
  - Unused imports: `Link`, `ChevronRight`, `Filter`, `AlertCircle`.
  - `isLoading` never rendered.

## `src/app/(dashboard)/expenses/page.tsx` + `ExpensesContent.tsx` - `/expenses`

- Wrapper: server component (fetches nothing). Content: client component.
- DB: PARTIAL. Queries Supabase `expenses` (org-scoped, ordered by date desc). Falls back to `defaultExpenses` on error or empty result.
- CRUD: MOSTLY REAL. Create/scan: `ReceiptCaptureModal` -> `createExpense` server action (real; also POSTs to `/api/ocr/scan-receipt` for OCR). Edit: `ExpenseEditModal` -> `updateExpense` (real). Delete: `deleteExpense` (real) - but wrapped in `catch (err: any) { console.warn("Expense delete server action fallback:", err.message) }` and the row is removed locally regardless of success.
- Filters/search: text search (number/description/merchant) + category `<select>` (6 hardcoded options) + status `<select>` (ALL/POSTED/APPROVED/SUBMITTED). No sorting, no pagination.
- Bugs:
  - The category filter is a hardcoded 6-option list (`Project Material`, `Subcontractor`, `Rent & Utilities`, `Software & CAD`, `Travel & Survey`, `Operations`) while `expenses.category` is a free-text nullable column - any other DB value is UNFILTERABLE and invisible under every category filter.
  - Status filter omits `DRAFT` and `REJECTED` although both are in the `ExpenseItem` type and `ExpenseStatus` enum.
  - "Primary Cost Driver: Project Material / 38.5%" is a hardcoded literal (line 258), not computed.
  - The created expense gets a locally-built row (`id: newExp.id || exp-${Date.now()}`, random `number`) from `ReceiptCaptureModal.onSuccess`; the DB-returned row is not used.
  - `handleSaveExpense` has NO create branch (only maps existing rows) - create logic is duplicated in the ReceiptCaptureModal callback.
  - The "server action fallback" warning is misleading: there is no fallback path, the row just vanishes from local state.
  - `isLoading` never rendered.

## `src/app/(dashboard)/invoices/page.tsx` - `/invoices`

- Client component, 492 lines.
- DB: PARTIAL. Queries Supabase `invoices` with an embedded `client:clients(name)` join, org-scoped, ordered by `created_at` desc. Falls back to `defaultInvoices` on error/empty.
- CRUD: REAL but lossy. `InvoiceModal` -> `createInvoiceRecord` / `updateInvoiceRecord`; delete -> `deleteInvoiceRecord`. All properly org-scoped.
- Filters/search: text search (number/client/project) + status tabs (All/Issued/Settled/Overdue). No sorting, no pagination.
- Bugs:
  - `InvoiceModal` create DOES NOT SEND `client_id` or `project_id` - it passes only number/dates/total/amount_paid/status. The typed `client_name` and `project` are SILENTLY DROPPED, so created invoices get `client_id = null` and the client name never reaches the DB, even though `createInvoiceRecord` accepts both.
  - `createInvoiceRecord` writes `subtotal: input.total, total: input.total` - no tax/VAT line and NO invoice_items rows, though an `invoice_items` table exists in the schema.
  - PHANTOM ID ON CREATE: `onSuccess(formData)` passes form data with no id, so the page inserts `id: inv-${Date.now()}`. Editing that row calls `updateInvoiceRecord` with a non-existent id. The page never refetches after a mutation.
  - `project` is hardcoded to the literal `"Project Milestone Billing"` for every real row (line 212) - the actual project is never joined.
  - "Days Sales Outstanding: 18.2 Days" is a hardcoded literal (line 274).
  - `totalPaidThisMonth` sums ALL `PAID` invoices regardless of date but is labelled "MTD" - not filtered to the month.
  - Status tabs omit `DRAFT`, `PARTIAL`, `CANCELLED`, `CREDIT_NOTE` (all in the Prisma `InvoiceStatus` enum) - a `PARTIAL` invoice renders with the generic "Issued" badge and cannot be filtered.
  - Delete swallows the error and removes locally regardless.
  - Unused imports: `Link`, `Filter`, `Calendar`, `Building2`, `Download`, `Mail`. `isLoading` never rendered.

## `src/app/(dashboard)/projects/page.tsx` + `ProjectsContent.tsx` - `/projects`

- Wrapper: server component (fetches nothing). Content: client component.
- DB: PARTIAL. Queries Supabase `projects` with `client:clients(name)` join, org-scoped, ordered by `created_at` desc. Falls back to `defaultProjects` (6 projects).
- CRUD: REAL. `ProjectModal` -> `createProject` / `updateProject`; delete -> `deleteProject`. Org-scoped server actions.
- Filters/search: text search (name/code/client) + status tabs (All/In Progress/Planning/Completed). No sorting, no pagination.
- Bugs - the fabricated ones are the most serious:
  - `spent_amount: Math.round(Number(p.contract_value || 0) * 0.55)` (line 219) - ACTUAL SPEND IS INVENTED as 55% of contract value for every project, and it drives the "Cost Incurred" figure and the progress bar on every real project card. Real spend data IS available (`expense_allocations`, `budget_versions`, `commitment_items` - all queried by `getProjectBudgetSummary` in the unused `dashboardActions.ts`).
  - `category: "Architecture & Interior"` and `deadline: "2025"` hardcoded for all real projects; fallback `Math.round(project.contract_value * 0.5)` at line 349.
  - "Average Project Margin: 38.5%" is a hardcoded literal (line 278).
  - `percent = Math.min(100, Math.round((spent / project.contract_value) * 100))` - DIVISION BY ZERO when `contract_value` is 0 -> `NaN` passed to `ProgressBar` (no guard).
  - PHANTOM ID ON CREATE: local id is `p-${Date.now()}`, and the "Budget" link points to `/projects/${project.id}` - for a newly created project that is `/projects/p-1731...` => not found. The page never refetches after a mutation.
  - The edit branch omits `spent_amount`, so it goes stale.
  - Delete swallows the error and removes locally regardless.
  - Status tabs omit `ON_HOLD` and `CANCELLED` (both in the Prisma `ProjectStatus` enum) -> unreachable by filter.
  - `isLoading` never rendered.

## `src/app/(dashboard)/projects/[id]/page.tsx` - `/projects/[id]`

- Client component. Uses `useParams()`.
- DB: REAL. Supabase query on `projects` with `client:clients(name)`, filtered by `.eq("id", projectId)` AND `.eq("organization_id", membership.organization_id)` - correctly org-scoped. Redirects to `/login` (no user), `/setup-organization` (no membership), `/projects` (error).
- CRUD: NONE - read-only. Filters/search/sort/paging: none.
- Bugs:
  - `project.type.toLowerCase().replace("_", " ")` (line 149) - NO NULL CHECK on `project.type`; the Prisma `ProjectType` column is an enum but the TS interface claims `type: string` while the DB column is nullable in practice -> runtime TypeError -> the catch pushes the user back to `/projects`, silently losing the detail view.
  - The "Financial Health Summary" card renders the literal string "-" for "Authorized Budget", "Incurred Expenditures" and "Remaining Variance" (lines 218, 222, 226) - a permanent placeholder, never populated, despite real budget/spend data being available.
  - The "Ledger & Cost Transactions" section is a HARDCODED EMPTY STATE - "No transactions recorded yet" is shown unconditionally (lines 234-245); there is no query for project transactions at all.
  - `parseFloat(project.contract_value)` with no NaN guard -> `formatCurrency(NaN)` renders "Rp NaN".
  - `notFound()` from `next/navigation` is not used, so the URL stays at the dead project id after the redirect.
  - Has a loading spinner and a not-found state - one of the few pages with proper handling.

## `src/app/(dashboard)/projects/clients/page.tsx` - `/projects/clients`

- Client component.
- DB: PARTIAL. Queries Supabase `clients` (org-scoped, ordered by name). Falls back to `defaultClients` (5 clients, incl. "Mrs. Dian Sastrowardoyo").
- CRUD: REAL but lossy. `ClientModal` -> `createClientRecord` / `updateClientRecord`; delete -> `deleteClientRecord`. Org-scoped.
- Filters/search: text search (name/company_type/email) only. No status filter, no sorting, no pagination.
- Bugs - heavy fabrication on real rows:
  - `company_type: "Corporate / Private Client"` (line 193), `total_projects: 1` (line 196), `total_billing: 250000000` (line 197), `status: "ACTIVE"` (line 198) are ALL hardcoded for every real client.
  - `total_billing: 250000000` is a FABRICATED Rp 250 million per client, and it feeds `totalContractAll` -> the "Aggregate Contract Portfolio" KPI. For a real org that KPI is a fiction.
  - `total_projects` is never counted from `projects`.
  - StatCards "Key Accounts (VIP): 3 Developers" and "Client Retention Rate: 100%" are hardcoded literals (lines 243, 251) - the "3" does not even match the 5 default clients.
  - `Badge variant={client.status === "VIP" ? "neutral" : "neutral"}` (line 308) - BOTH BRANCHES IDENTICAL, a copy-paste no-op.
  - FIELD LOSS: `ClientModal` collects `company_type`, `total_projects`, `total_billing`, `status` but only sends `name`, `email`, `phone` to the server, so they are DISCARDED on save. The `clients` table (Prisma `Client` model) has only name/email/phone/address/contact_person/tax_id - no such columns exist.
  - Delete swallows errors and removes locally regardless.
  - `isLoading` never rendered.

## `src/app/(dashboard)/reimbursements/page.tsx` - `/reimbursements`

- Client component, 446 lines.
- DB: PARTIAL. Queries Supabase `reimbursements` (org-scoped, ordered by `created_at` desc). Falls back to `defaultReimbursements` (4 records) on error or empty.
- CRUD: FAKE. `ReimbursementModal` does NOT call any server action - its `handleSubmit` only calls `onSuccess(formData)` and `onClose()`. NOTHING is persisted. `handleDeleteClaim` filters local state only. There is **no `reimbursements` server action file at all** (grep over `src/app/actions` finds no reimbursement action) even though a `reimbursements` table and `Reimbursement` Prisma model exist.
- Filters/search: text search (number/description/employee) + status tabs (All/Pending/Approved/Settled). No sorting, no pagination.
- Bugs:
  - `employee: "Studio Staff"` hardcoded for every real row (line 167); the real `employee_id` is never resolved.
  - "Average Turnaround: 1.8 Days" is a hardcoded literal (line 229).
  - The Prisma `Reimbursement` model has `paid_amount` and `status` incl. `DRAFT`/`REJECTED`; the UI's `ReimbursementItem` type uses a different set and the tabs omit DRAFT/REJECTED.
  - `ReceiptCaptureModal.onSuccess` builds a claim with a RANDOM number `RMB-${year}-${random 1000-9999}` and a hardcoded `employee: "Current Architect / Project Lead"` - and since nothing is persisted, that number can collide with the `@@unique([organization_id, number])` constraint if persistence is ever added.
  - The receipt-scanner is wired to the REIMBURSEMENTS page but calls `createExpense` (an EXPENSE server action) - scanning a reimbursement receipt actually creates an expense row.
  - `isLoading` never rendered.

## `src/app/(dashboard)/transfers/page.tsx` - `/transfers`  **FAKE**

- Client component, 373 lines. **No DB access whatsoever** - no `createClient`, no server action import, no fetch.
- DB: NONE. The entire dataset is `defaultTransfers` (4 records, `TRF-2024-0021` etc.).
- CRUD: FAKE. `handleTransfer` pushes a new row into local React state and shows a success toast ("Internal fund transfer successfully executed and account balances have been synchronized") - **but no account balance is synchronized, and nothing is written anywhere.** There is no `cash_transfers` insert anywhere in the app even though the `CashTransfer` Prisma model and table exist.
- Filters/search: text search over reference/notes/from/to. No sorting, no pagination.
- Bugs:
  - The success message explicitly claims balances were synchronized. They are not. **This is a false statement to the user.**
  - The transfer form's account dropdowns are HARDCODED: source options are exactly "BCA Corporate Checking" (Rp 342,000,000), "Mandiri Business Treasury" (Rp 218,500,000), "Studio Petty Cash Vault" (Rp 24,000,000) - the demo accounts, not the org's real `cash_accounts`. A user with a different org cannot select their own account, and the "balances" shown are the demo ones.
  - The transfer-fee rule is nonsense: `fromAccount !== toAccount && fromAccount.includes("Bank") && toAccount.includes("Bank") ? 2500 : 0` - the account names contain "Mandiri Business Treasury"/"BCA Corporate Checking" and NEVER the string "Bank", so the fee is ALWAYS 0. Dead logic.
  - The reference number is generated as `TRF-2024-00${transfers.length + 22}` - hardcoded 2024 and collision-prone (deleting a row renumbers; two creates in the same session can collide).
  - `processedBy: "Finance Director"` hardcoded - no actor is recorded.
  - `setTimeout(() => setSuccessNotice(false), 4000)` not cleaned up.
  - Unused imports: `Calendar`, `FileText`, `AlertCircle`, `Building2`.
  - Not in the middleware `protectedRoutes` list.

## `src/app/(dashboard)/vendors/page.tsx` - `/vendors`

- Client component, 422 lines.
- DB: PARTIAL. Queries Supabase `vendors` (org-scoped, ordered by name). Falls back to `defaultVendors` (5 vendors) on error or empty.
- CRUD: REAL but lossy. `VendorModal` -> `createVendorRecord` / `updateVendorRecord`; delete -> `deleteVendorRecord`. Org-scoped.
- Filters/search: text search (name/category/email) + a `categoryFilter` state. No sorting, no pagination.
- Bugs - the worst fabrication ratio in the app:
  - For every real vendor the page hardcodes `category: "Procurement Partner"`, `address: "Registered Enterprise Headquarters"` (overwriting the REAL `address` from the DB!), `total_spend: 35000000`, `active_projects: 1`, `rating: "Active Vendor"`.
  - **`total_spend: 35000000` is a fabricated Rp 35 million per vendor** and it feeds the "Procurement Spend" KPI - a fiction for any real org.
  - The real `vendors.address` column IS selected (`select("*")`) and is then discarded and replaced with the literal "Registered Enterprise Headquarters".
  - FIELD LOSS: `VendorModal` collects `category`, `rating`, `total_spend`, `active_projects` (lines 181, 203, 285, 306) but sends ONLY name/email/phone/address to the server - all four are DISCARDED on save. `VendorInput` and the `vendors` table have no such columns (Prisma `Vendor` model: name/email/phone/address/tax_id/bank_name/bank_account/bank_holder). So the card fields are pure fiction and cannot be persisted.
  - The `categoryFilter` state exists but NO select control is ever rendered for it - **the filter is dead code**; every category filter value is hardcoded in the query mapping so the filter can never match.
  - StatCards "Primary Suppliers: 2 Key Partners" and "Verified Compliance: 100% Licensed" are hardcoded literals (lines 253, 261).
  - Delete swallows errors and removes locally regardless.
  - Unused imports: `MapPin` is imported? (no) - `MapPin` not imported; `isLoading` never rendered.

## `src/app/(dashboard)/reports/balance-sheet/page.tsx` - `/reports/balance-sheet`

- Client component, 244 lines. **DB: NONE.** Entirely `defaultBalanceSheetData` (7 asset lines, 3 liability lines, 2 equity lines).
- CRUD: none. Read-only statement.
- Filters: an "As of Date" input and an "Apply Date Filter" button - the button does `setTimeout(400)` then `setData(defaultBalanceSheetData)`. **The date has zero effect.** "Print PDF" calls `window.print()` (works). **"Export CSV" has NO onClick - the button is completely inert.**
- Internally consistent: assets sum to 771,000,000 and liabilities 92,000,000 + equity 538,350,000 + P/L 140,650,000 = 771,000,000, so the "Perfect Accounting Equilibrium Verified" banner shows Balanced.
- Bugs: the balance check is on HARDCODED numbers, so it is a self-fulfilling assertion; `isBalanced` compares `total_assets` to a computed sum of hardcoded fields and can never be false. The real `getBalanceSheetData(asOfDate)` in `src/lib/reports/reportService.ts` is unused. `data` is state but never changes.

## `src/app/(dashboard)/reports/cash-flow/page.tsx` - `/reports/cash-flow`

- Client component, 264 lines. **DB: NONE.** Entirely `defaultCashFlowData`.
- CRUD: none. Filters: start/end date inputs + "Apply Period Filter" (`setTimeout(400)`, date ignored). "Print PDF" works; **"Export CSV" is inert (no onClick).**
- ARITHMETIC BUG in the demo data: operating activities sum to +143,000,000; investing to -20,500,000; financing to +16,500,000; total = **+139,000,000**, but the page hardcodes `net_change: 142,500,000` and `closing_balance: 584,500,000` (= opening 442,000,000 + 142,500,000). The activity lines do not reconcile to the stated net change - a 3,500,000 discrepancy. The page prints the hardcoded `net_change` alongside the computed subtotals, so the statement contradicts itself on screen.
- The real `getCashFlowData(startDate, endDate)` in `src/lib/reports/reportService.ts` is unused.
- `operatingTotal`/`investingTotal`/`financingTotal` are computed but the grand total is NOT derived from them.

## `src/app/(dashboard)/reports/general-ledger/page.tsx` - `/reports/general-ledger`

- Client component, 306 lines. **DB: NONE.** Two hardcoded account ledgers (1120 BCA, 1210 AR) with hand-written JE lines.
- CRUD: none. Filters: start/end date inputs, an account `<select>` (options hardcoded to "all" / 1120 / 1210 - **not populated from the `accounts` table**), and "Apply Filter" (`setTimeout(400)`, dates ignored). "Print PDF" works; **"Export CSV" is inert.**
- The hardcoded demo ledger is internally consistent (opening + debits - credits = closing, and the running balances reconcile line by line) - the numbers are simply invented.
- Bugs: the account dropdown is a fixed two-entry list, so any real chart of accounts is unreachable; `filteredData` filters `account_code` against a hardcoded select value. There is no `getGeneralLedger` function in `reportService.ts` at all (only the `GeneralLedgerReport` interface exists), so this page has no real backend to hook into even if the author wanted to.

## `src/app/(dashboard)/reports/income-statement/page.tsx` - `/reports/income-statement`

- Client component, 314 lines. **DB: NONE.** Entirely `defaultReportData`.
- CRUD: none. Filters: start/end date + "Apply Filter" (`setTimeout(400)`, dates ignored). "Print PDF" works; **"Export CSV" is inert.**
- The hardcoded statement IS internally consistent: revenue 185+125+35 = 345,000,000 = `total_revenue`; COS 78+48+12 = 138,000,000; gross 207,000,000; OPEX 38+15+4.5+6.5+3.2 = 67,200,000; net 207-67.2+1.2-0.35 = 140,650,000. Margins 60.0% / 40.8%.
- Bugs: the report header hardcodes the entity name **"PT Desain Lintas Masa"** (line 137) - a completely different legal entity from "Time Travel Design" and from the org name in settings. The badge says "AUDITED FINANCIAL STATEMENT" on a hardcoded demo. `grossMargin`/`netMargin` divide by `total_revenue` with no zero-guard. The real `getIncomeStatementData(startDate, endDate)` is unused. Unused imports: `Calendar`, `TrendingUp`, `Sparkles`, `Badge`.

## `src/app/(dashboard)/reports/trial-balance/page.tsx` - `/reports/trial-balance`

- Client component, 280 lines. **DB: NONE.** Entirely `defaultTrialBalanceData` (9 account rows).
- CRUD: none. Filters: start/end date + "Apply Period Filter" (`setTimeout(400)`, dates ignored). "Print PDF" works; **"Export CSV" is inert.**
- **THE DATA IS NOT BALANCED.** Closing debits total 887,700,000; closing credits total 829,500,000 - a **58,200,000 discrepancy**. Opening debits 550,000,000 vs opening credits 475,000,000 - a 75,000,000 discrepancy. The table header nevertheless displays a badge reading **"DOUBLE-ENTRY RECONCILIATION VERIFIED"** (line 214), and the footer is labelled "EQUILIBRIUM TOTALS" (line 266). **The page asserts a reconciliation it does not perform and does not achieve.**
- No balance check is computed anywhere in this file, unlike the balance-sheet page.
- The real `getTrialBalanceData(startDate, endDate)` in `src/lib/reports/reportService.ts` is unused.

## `src/app/(dashboard)/settings/accounts/page.tsx` - `/settings/accounts` (Chart of Accounts)

- Client component, 427 lines.
- DB: REAL. Queries Supabase `accounts` scoped to the org, ordered by `code`; redirect to `/login` / `/setup-organization` as needed. `if (error) throw error` is handled.
- CRUD: REAL and the only genuinely working CRUD page in the app - create via `supabase.from("accounts").insert(...)`, edit via `.update({ name }).eq("id", ...).eq("is_system", false)`. **The edit is restricted to the `name` field only** (code, type and normal_balance are not editable even though the form collects them - the modal simply hides those inputs when editing, and the update sends only `name`).
- Filters/search: text search over code+name and a type `<select>`; accounts are grouped by type into sections. No sorting, no pagination.
- Bugs:
  - `const supabase = createClient();` is called at MODULE/RENDER level (line 47) on every render, not memoised - a new Supabase client per render.
  - `accountTypeConfig[type]` is indexed WITHOUT a null check (line 254-255) - `config.icon` will throw if the DB ever contains a type outside the hardcoded 8-entry map. `config` is also unused apart from `.icon`/`.label`.
  - `groupedAccounts` is built with a plain `reduce` into `Record<string, Account[]>` - unsorted group order.
  - Errors use `alert("Failed to save account specification")` (blocking browser dialog) and `alert("System core accounts cannot be modified")` - inconsistent with the rest of the app's inline error styling.
  - **No delete/deactivate** for non-system accounts, and `is_active` is never surfaced or toggled - deactivated accounts would still render.
  - The insert relies on RLS alone for org scoping (no `requireAuthUser()`), unlike the server actions; `organization_id` comes from the client-read membership row.
  - `is_system` accounts are protected from edit but there is no server-side guarantee - the `.eq("is_system", false)` is on the UPDATE, so it is enforced by the query. OK.
  - No `parent_id` usage despite the field being in the interface - no hierarchy/sub-account support (the Prisma `Account` model has `parent_id`).

## `src/app/(dashboard)/settings/organization/page.tsx` - `/settings/organization`

- Client component, 177 lines.
- DB: REAL. Reads `organization_members` with an embedded `organization:organizations(*)` join, populates the form, and saves via `supabase.from("organizations").update(formData).eq("id", organization.id)`.
- CRUD: real (read + update). No filters.
- Bugs:
  - `useState<any>(null)` for the organization.
  - **The update does not scope by organization_id** - it filters only on `.eq("id", organization.id)`; a stale/malicious id could update another org if RLS does not cover it. The server-action pattern used elsewhere (`.eq("organization_id", user.organizationId)`) is not applied.
  - **The `supabase` update result is never checked** - `{ error }` is discarded, so a failed update still shows the green "Organization master record updated successfully" banner. The `try/catch` cannot catch a PostgREST error because Supabase returns errors in the payload rather than throwing.
  - `setTimeout(() => setSaved(false), 2000)` not cleaned up.
  - `console.error("Error:", error)` only - no user-visible error state.
  - The embedded-select shape is handled with `Array.isArray(membership.organization) ? membership.organization[0] : membership.organization` - a defensive cast for a PostgREST to-one embed that is always an object; `.single()` on the membership will error for multi-org users, and `if (!membership?.organization) return;` then leaves the page on the "Restricted Administrative Access" screen with NO loading state cleared correctly (isLoading is set false in `finally`, so the user sees "Restricted Administrative Access" for a legitimate multi-org member).
  - The page has no role check despite the copy "Restricted Administrative Access" - the restriction is only enforced by RLS.

## `src/app/(dashboard)/settings/users/page.tsx` - `/settings/users`

- Client component, 184 lines.
- DB: REAL. Reads `profiles` for the current user; saves via `supabase.from("profiles").upsert({ id, email, full_name, phone })`. Sign-out via the real `signOut()` server action + `router.push("/login")`.
- CRUD: real for the CURRENT user's own profile only. **The page is titled "Users & Permissions" in the sidebar but contains NO user list, NO invite, NO role/approval-limit management, and NO member administration** - it is a self-service profile form. There is no `organization_members` admin UI anywhere in the app.
- Filters: none.
- Bugs:
  - `useState<any>(null)` for the profile.
  - The `upsert` includes `email: user.email` - it can overwrite the email with the auth email, but `user.email` may be null for phone-only accounts -> `email: null` written over an existing email. No null guard.
  - The upsert result is not checked - a failure still shows the green "Profile specifications saved successfully" banner; Supabase errors do not throw.
  - `setTimeout(() => setSaved(false), 2000)` not cleaned up.
  - `handleLogout` calls `signOut()` which itself calls `redirect("/login")` (a server-action redirect) AND then the client does `router.push("/login")` - double navigation.
  - The "Corporate Email" input is disabled and shows `profile?.email` - if the profiles row is missing, it renders empty with no explanation.
  - No error state if the profile row does not exist.

---

# SUMMARY TABLE

| Route | Component type | Real DB? | CRUD status | Filters | Verdict |
|---|---|---|---|---|---|
| `/` | server | no | none | none | marketing mockup (acceptable) |
| `/login` | client | YES (action) | working | none | OK, minor bugs |
| `/register` | client | YES (action) | working | none | OK, client-only validation |
| `/setup-organization` | client + action | YES (action) | working | none | best-written; no transaction |
| `/api/auth/callback` | route handler | YES | n/a | n/a | open redirect + `.single()` bug |
| `/dashboard` | server wrapper + client | PARTIAL (3 of ~15 figures) | none | cosmetic period only | **demo-heavy** |
| `/approvals` | client | **NONE** | **fake (setTimeout)** | status tabs | **FAKE STUB** |
| `/cash-accounts` | client | PARTIAL | real (actions) | none | phantom-id bug |
| `/cash-advances` | client | PARTIAL | **fake (no action call)** | search + tabs | **FAKE CRUD** |
| `/expenses` | client | PARTIAL | real | search + 2 selects | mostly OK |
| `/invoices` | client | PARTIAL | real but lossy | search + tabs | client_id dropped |
| `/projects` | client | PARTIAL | real but lossy | search + tabs | **spend = 55% fake** |
| `/projects/[id]` | client | YES | none | none | has placeholder sections |
| `/projects/clients` | client | PARTIAL | real but lossy | search only | **billing = 250M fake** |
| `/reimbursements` | client | PARTIAL | **fake (no action exists)** | search + tabs | **FAKE CRUD** |
| `/transfers` | client | **NONE** | **fake** | search | **FAKE STUB** |
| `/vendors` | client | PARTIAL | real but lossy | search (+ dead filter) | **spend = 35M fake** |
| `/reports/balance-sheet` | client | **NONE** | none | date (inert) | **FAKE** |
| `/reports/cash-flow` | client | **NONE** | none | dates (inert) | **FAKE + doesn't foot** |
| `/reports/general-ledger` | client | **NONE** | none | dates+account (inert) | **FAKE** |
| `/reports/income-statement` | client | **NONE** | none | dates (inert) | **FAKE** |
| `/reports/trial-balance` | client | **NONE** | none | dates (inert) | **FAKE + doesn't balance** |
| `/settings/accounts` | client | YES | real (name-only edit) | search + type | best CRUD page |
| `/settings/organization` | client | YES | real (unchecked error) | none | org-scoped bug |
| `/settings/users` | client | YES | self-profile only | none | missing admin features |

# CROSS-CUTTING ISSUES

1. **Unused real backends.** `src/lib/reports/reportService.ts` (4 functions) and `src/app/actions/dashboardActions.ts` (5 functions) - plus `cashAdvanceActions.ts` (7 functions including disburse/settle) and the `approveExpense`/`rejectExpense`/`submitExpense` functions in `expenseActions.ts` - are implemented and org-scoped, yet no page calls them. The app has the accounting engine but presents a mockup.
2. **Empty-org shows fake money.** Every list page keeps `defaultXxx` in state and only overwrites it when the query returns rows. For a new tenant, the app confidently displays Rp 2.45 billion of treasury, 6 projects, 5 clients, 5 vendors, 5 invoices and 4 transfers that do not exist, with no "no data yet" empty state anywhere. This is the single most damaging issue for a financial system: **a user cannot distinguish real balances from fabricated ones.**
3. **Fabricated fields inside the "real" branches.** `spent_amount = contract_value * 0.55` (projects), `total_billing = 250000000` (clients), `total_spend = 35000000` (vendors), `project = "Project Milestone Billing"` (invoices), `employee = "Studio Staff"` (reimbursements/cash advances), `address = "Registered Enterprise Headquarters"` (vendors, overwriting a real column), `category`/`rating`/`total_spend`/`active_projects` (vendors, clients). These are not "fallbacks" - they are returned for every real row.
4. **Phantom IDs on create.** `onSuccess(formData)` is called with the form payload rather than the server-returned row, so created records get `id: inv-${Date.now()}` / `p-${Date.now()}` / `ca-${Date.now()}`. The next edit on such a row targets a non-existent DB id, and the `/projects/[id]` link from a newly created project 404s. The pages also never refetch after a mutation.
5. **Silent failure on delete.** Five pages wrap the delete action in `catch { console.warn("... server action fallback:") }` and then remove the row from local state unconditionally - so a failed delete still looks successful, and the row reappears on refresh.
6. **Schema columns that are collected but never persisted.** `category`, `rating`, `total_spend`, `active_projects` (vendors); `company_type`, `total_projects`, `total_billing`, `status` (clients); `client_id`, `project_id` (invoices) - all present in the modal forms, all dropped before the server call, and all re-faked on read.
7. **Inert controls.** "Export CSV" on all five report pages has no `onClick`. Every report date filter is cosmetic. The "Apply" buttons only replay the constant.
8. **Unreconciled demo statements.** The trial balance does not balance (58.2M gap) yet is badged "DOUBLE-ENTRY RECONCILIATION VERIFIED"; the cash flow's activity lines sum to 139M against a stated 142.5M net change; the income statement header names a different legal entity ("PT Desain Lintas Masa").
9. **No loading.tsx / error.tsx / not-found.tsx anywhere** (0 files). No page has a route-level error boundary. `isLoading` is set in 8 pages and rendered in none.
10. **Security / auth gaps.** Open redirect in `/api/auth/callback` via unvalidated `next`; `/cash-accounts`, `/transfers` and `/setup-organization` missing from `middleware.ts` `protectedRoutes`; `/forgot-password` linked but nonexistent; `resetPassword` redirects to a nonexistent `/auth/callback/reset-password`; the org-settings update is not scoped by `organization_id`; `setupOrganization` bypasses RLS via Prisma and is not transactional; `signUp` validates password length only on the client.
11. **Status-enum gaps.** Prisma enums `InvoiceStatus` (PARTIAL/CANCELLED/CREDIT_NOTE/DRAFT), `ProjectStatus` (ON_HOLD/CANCELLED), `ExpenseStatus` (DRAFT/REJECTED/UNDER_REVIEW), `ReimbursementStatus` and `CashAdvanceStatus` (DRAFT/SUBMITTED/REJECTED/CANCELLED) all contain values that no filter tab exposes, so those rows are unreachable or mislabelled.
12. **Minor/cleanup.** `useState<any>` in two settings pages; `catch (err: any)` in 8 files; `setTxFilter(f.id as any)`; unused imports in ~8 pages (also two dead imports in `approvals/page.tsx`); `new PrismaClient()` at module scope in `setup-organization/actions.ts`; `createClient()` called on every render in `settings/accounts/page.tsx`; `setTimeout`s not cleaned up (register, transfers, both settings pages); `alert()` used for errors in `settings/accounts`; `lang="en"` on an Indonesian app.

# RECOMMENDED PRIORITY

1. Wire the 5 report pages and the dashboard to `src/lib/reports/reportService.ts` and `src/app/actions/dashboardActions.ts` (they already exist and are org-scoped). Highest value, lowest new code.
2. Remove the `defaultXxx` demo arrays from every page's initial state; render a proper empty state instead. Delete the demo datasets entirely so fabricated numbers can never be displayed.
3. Stop fabricating fields in the real-data branches - read actual columns or omit them.
4. Make the mutating pages use the server action's RETURN value (real id) and refetch after write; surface action errors instead of `console.warn`.
5. Wire `cashAdvanceActions`, `approveExpense`/`rejectExpense` and `submitExpense` into `/approvals` and `/cash-advances`; create a `reimbursements` action file; add a `cash_transfers` insert for `/transfers`.
6. Fix the open redirect, add the three missing protected routes, and add `loading.tsx` / `error.tsx` for the dashboard group.

**Note:** this full report was also written to `AUDIT_PAGES.md` in the repo root for reference.
