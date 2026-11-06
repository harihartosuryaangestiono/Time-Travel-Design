UPDATE public.journal_lines AS journal_line
SET project_id = NULL
FROM public.journal_entries AS journal
JOIN public.expenses AS expense
  ON expense.id = journal.source_id
 AND expense.organization_id = journal.organization_id
WHERE journal_line.journal_id = journal.id
  AND journal.source_type = 'CASH_BOOK_EXPENSE'
  AND lower(trim(expense.category)) IN (
    'marketing & sales',
    'marketing and sales',
    'marketing n sales',
    'marketing sales',
    'biaya marketing'
  )
  AND journal_line.project_id IS NOT NULL;
