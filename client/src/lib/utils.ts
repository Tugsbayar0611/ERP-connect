import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMNT(value: number) {
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + '₮';
}

/**
 * Format a date string to display.
 * Strip timezone suffix (Z) to treat all timestamps as local time.
 */
export function formatLocalDate(
  dateStr: string | Date | null | undefined,
  formatStr: string = "yyyy-MM-dd HH:mm"
): string {
  if (!dateStr) return "-";
  try {
    let normalized = dateStr;
    if (typeof dateStr === 'string') {
      // Strip Z suffix to treat as local time (server stores in local timezone)
      normalized = dateStr.replace(/Z$/, '').replace(/\+00:00$/, '');
    }
    const date = typeof normalized === 'string' ? new Date(normalized) : normalized;
    if (isNaN(date.getTime())) return "-";
    return format(date, formatStr);
  } catch {
    return "-";
  }
}
