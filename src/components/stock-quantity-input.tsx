import { useId, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function StockQuantityInput({
  unit,
  name,
  label,
  initialValue,
  positive = false,
}: {
  unit: string
  name: string
  label: string
  initialValue?: string
  positive?: boolean
}) {
  const id = useId()
  const places = unit === "kg" || unit === "l" ? 2 : 0
  const startingValue = unit === "g" || unit === "ml" ? 100 : 1
  const [value, setValue] = useState(() =>
    Number(initialValue ?? startingValue).toFixed(places)
  )
  const increment = places === 2 ? 0.1 : 1
  const minimum = positive ? (places === 2 ? 0.01 : 1) : 0

  function changeQuantity(direction: number) {
    // Work in hundredths so repeated arrow presses do not accumulate float errors.
    const scale = 10 ** places
    const next =
      (Math.round(Number(value) * scale) +
        direction * Math.round(increment * scale)) /
      scale
    setValue(Math.max(minimum, next).toFixed(places))
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type="number"
          min={minimum}
          // Allow any two-decimal value while the arrows move by 0.10.
          step={places === 2 ? "0.01" : "1"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => {
            if (value !== "" && Number.isFinite(Number(value))) {
              setValue(Number(value).toFixed(places))
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault()
              changeQuantity(event.key === "ArrowUp" ? 1 : -1)
            }
          }}
          className="[appearance:textfield] pr-10 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          required
        />
        <div className="absolute inset-y-1 right-3 flex flex-col">
          {[
            { direction: 1, action: "Increase", arrow: "▴" },
            { direction: -1, action: "Decrease", arrow: "▾" },
          ].map(({ direction, action, arrow }) => (
            <button
              key={direction}
              type="button"
              aria-label={`${action} ${label.toLowerCase()}`}
              onClick={() => changeQuantity(direction)}
              className="flex h-3.5 w-5 items-center justify-center rounded text-xs text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            >
              {arrow}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
