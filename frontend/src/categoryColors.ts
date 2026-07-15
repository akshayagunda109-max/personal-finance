// Fixed hue order for the 8 "real" spend/income categories, per the validated
// categorical palette. Transfers and Uncategorized are not identity categories
// in the same sense (they represent "no real signal"), so they get the muted
// text color instead of consuming a hue slot - keeping the palette within the
// 8-slot ceiling the validator was run against.
const CATEGORY_HUE_ORDER = [
  'Food & Dining',
  'Groceries',
  'Travel / Transport',
  'Entertainment',
  'Shopping',
  'Bills & Utilities',
  'Healthcare',
  'Income',
]

export function categoryColorVar(category: string): string {
  const idx = CATEGORY_HUE_ORDER.indexOf(category)
  if (idx === -1) return 'var(--text-muted)'
  return `var(--series-${idx + 1})`
}

// Mirrors backend app/services/categories.py - the fixed set a transaction
// can be manually reassigned to. Investing/Trading, Transfers, and
// Uncategorized render in the muted color rather than a fixed hue (see
// categoryColorVar) - they're not identity categories in the same sense as
// the 8 in CATEGORY_HUE_ORDER, and the validated palette is capped at 8.
export const ALL_CATEGORIES = [...CATEGORY_HUE_ORDER, 'Investing / Trading', 'Transfers', 'Uncategorized']
