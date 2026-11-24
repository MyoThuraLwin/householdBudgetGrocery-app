import { useId, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { money } from "@/lib/api"
import { monthlyExpensePreview } from "@/lib/expense-amount"
import type { Commitment } from "@/lib/models"

export function ExpenseInputs({
  month,
  commitment: c,
}: {
  month: string
  commitment?: Commitment
}) {
  const id = useId()
  const [category, setCategory] = useState<string>(
    c?.category ?? "accommodation"
  )
  const [frequency, setFrequency] = useState<string>(c?.frequency ?? "monthly")
  const [monthlyAmount, setMonthlyAmount] = useState(String(c?.planned ?? "0"))
  const [weeklyAmount, setWeeklyAmount] = useState(
    c?.frequency === "weekly" ? String(c.inputAmount) : ""
  )
  const [outstanding, setOutstanding] = useState(String(c?.outstanding ?? "0"))
  const [outstandingEdited, setOutstandingEdited] = useState(false)
  const [settlement, setSettlement] = useState<string>(
    c?.settlement ?? "unpaid"
  )
  const weekly = frequency === "weekly"
  const inputAmount = weekly ? weeklyAmount : monthlyAmount
  const planned = monthlyExpensePreview(inputAmount, weekly, month)
  const changedPlan = planned !== null && Number(planned) !== Number(c?.planned)
  const remaining =
    settlement === "settled"
      ? "0"
      : !outstandingEdited && changedPlan
        ? Math.max(0, Number(planned) - Number(c?.actualTotal ?? 0)).toFixed(2)
        : outstanding
  const monthLabel = new Intl.DateTimeFormat("en-NZ", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`))
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-category`}>Category</Label>
          <select
            id={`${id}-category`}
            name="category"
            className="native-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[
              "accommodation",
              "electricity",
              "internet",
              "phone",
              "transport",
              "other",
            ].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-frequency`}>Amount entered as</Label>
          <select
            id={`${id}-frequency`}
            name="frequency"
            className="native-select"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-amount`}>
          {weekly ? "Weekly" : "Monthly"} amount (NZD)
        </Label>
        <Input
          id={`${id}-amount`}
          name="inputAmount"
          type="number"
          min="0"
          step="0.01"
          required
          value={inputAmount}
          onChange={(e) =>
            weekly
              ? setWeeklyAmount(e.target.value)
              : setMonthlyAmount(e.target.value)
          }
          aria-describedby={`${id}-preview`}
        />
      </div>
      <div
        id={`${id}-preview`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="rounded-xl border bg-muted/40 p-3 text-sm"
      >
        <p>Monthly planned expense · {monthLabel}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">
          {planned === null ? "Enter an amount" : money(planned)}
        </p>
      </div>
      {c && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-outstanding`}>
              Outstanding monthly amount (NZD)
            </Label>
            <Input
              id={`${id}-outstanding`}
              name="outstanding"
              type="number"
              min="0"
              step="0.01"
              required
              value={remaining}
              onChange={(e) => {
                setOutstanding(e.target.value)
                setOutstandingEdited(true)
              }}
            />
            <p className="text-xs text-muted-foreground">
              Review the monthly amount still unpaid after changing your plan.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-settlement`}>Settlement</Label>
            <select
              id={`${id}-settlement`}
              name="settlement"
              className="native-select"
              value={settlement}
              onChange={(e) => setSettlement(e.target.value)}
            >
              {["unpaid", "partial", "settled"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  )
}
