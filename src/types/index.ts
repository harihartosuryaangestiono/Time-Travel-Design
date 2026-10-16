// Application Types for TimeTravelDesign Finance

export type Role = "OWNER" | "FINANCE" | "PROJECT_MANAGER" | "SITE_STAFF" | "VIEWER";

export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";

export type ProjectType = "ARCHITECTURE" | "INTERIOR_DESIGN" | "RENOVATION" | "CONSTRUCTION" | "OTHER";

export type ExpenseStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "POSTED" | "REVERSED";

export type CashAdvanceStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "DISBURSED" | "PARTIALLY_SETTLED" | "SETTLED" | "CANCELLED";

export type ReimbursementStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED";

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED" | "CREDIT_NOTE";

export type BudgetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export type JournalStatus = "DRAFT" | "POSTED" | "REVERSED";

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "COST_OF_SALES" | "EXPENSE" | "OTHER_INCOME" | "OTHER_EXPENSE";

export type CashAccountType = "CASH" | "BANK" | "E_WALLET" | "OTHER";

export interface User {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
}

export interface OrganizationMember {
  id: string;
  role: Role;
  approval_limit?: number;
  profile: User;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  client_id?: string;
  client?: Client;
  type: ProjectType;
  status: ProjectStatus;
  location?: string;
  start_date?: string;
  end_date?: string;
  contract_value?: number;
  description?: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_person?: string;
}

export interface Expense {
  id: string;
  number: string;
  date: string;
  merchant?: string;
  description: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  payment_method?: string;
  cash_account_id?: string;
  status: ExpenseStatus;
  receipt_id?: string;
  submitted_by: string;
  submitter?: User;
  notes?: string;
  allocations: ExpenseAllocation[];
}

export interface ExpenseAllocation {
  id: string;
  expense_id: string;
  project_id: string;
  project?: Project;
  amount: number;
  description?: string;
}

export interface CashAccount {
  id: string;
  name: string;
  type: CashAccountType;
  account_number?: string;
  bank_name?: string;
  opening_balance: number;
  opening_date: string;
  is_active: boolean;
  current_balance?: number;
}

export interface CashAdvance {
  id: string;
  number: string;
  date: string;
  employee_id: string;
  employee?: User;
  project_id?: string;
  project?: Project;
  purpose: string;
  amount: number;
  status: CashAdvanceStatus;
  disbursed_amount: number;
  settled_amount: number;
  returned_amount: number;
  remaining_balance?: number;
}

export interface Reimbursement {
  id: string;
  number: string;
  date: string;
  employee_id: string;
  employee?: User;
  amount: number;
  description: string;
  status: ReimbursementStatus;
  paid_amount: number;
}

export interface Invoice {
  id: string;
  number: string;
  invoice_date: string;
  due_date: string;
  client_id: string;
  client?: Client;
  project_id?: string;
  project?: Project;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  remaining_amount?: number;
  status: InvoiceStatus;
}

export interface BudgetVersion {
  id: string;
  project_id: string;
  version_number: number;
  title: string;
  status: BudgetStatus;
  subtotal: number;
  tax_amount: number;
  total: number;
  is_locked: boolean;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  number: string;
  date: string;
  posting_date?: string;
  description: string;
  source_type?: string;
  source_id?: string;
  status: JournalStatus;
  lines: JournalLine[];
  creator?: User;
  posted_at?: string;
}

export interface JournalLine {
  id: string;
  account_id: string;
  account?: Account;
  debit?: number;
  credit?: number;
  description?: string;
  project_id?: string;
  project?: Project;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  parent_id?: string;
  normal_balance: "DEBIT" | "CREDIT";
  is_active: boolean;
  is_system: boolean;
}

export interface DashboardMetrics {
  total_cash: number;
  total_income: number;
  total_expenses: number;
  net_profit: number;
  outstanding_receivables: number;
  outstanding_payables: number;
  outstanding_cash_advances: number;
  pending_approvals: number;
  overdue_invoices: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

// OCR Types
export interface OCRExtraction {
  merchant?: string;
  receipt_number?: string;
  date?: string;
  time?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  currency?: string;
  payment_method?: string;
  items?: Array<{
    description: string;
    quantity?: number;
    unit_price?: number;
    total?: number;
  }>;
  confidence?: number;
}

export interface ReceiptUpload {
  file: File;
  ocr_status?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  ocr_data?: OCRExtraction;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// Form Types
export interface ExpenseFormData {
  date: Date;
  merchant?: string;
  description: string;
  amount: number;
  tax_amount?: number;
  payment_method?: string;
  cash_account_id?: string;
  category_id?: string;
  project_allocations: Array<{
    project_id: string;
    amount: number;
    description?: string;
  }>;
  receipt_id?: string;
  notes?: string;
}

export interface CashAdvanceFormData {
  date: Date;
  employee_id: string;
  project_id?: string;
  purpose: string;
  amount: number;
  notes?: string;
}
