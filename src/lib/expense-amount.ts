export function daysInMonth(month: string) {
  const [year, number] = month.split("-").map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    number - 1
  ]
}

// Use integer cents so the preview matches the API's single decimal rounding.
export function monthlyExpensePreview(
  amount: string,
  weekly: boolean,
  month: string
) {
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(amount)) return null
  const [whole, fraction = ""] = amount.split(".")
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))
  const monthly = weekly
    ? (cents * BigInt(daysInMonth(month)) + 3n) / 7n
    : cents
  return `${monthly / 100n}.${String(monthly % 100n).padStart(2, "0")}`
}
