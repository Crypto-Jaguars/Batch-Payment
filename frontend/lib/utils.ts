import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function truncateAddress(address: string, start = 6, end = 6): string {
  if (!address) return ""
  if (address.length <= start + end) return address
  return `${address.slice(0, start)}...${address.slice(-end)}`
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

