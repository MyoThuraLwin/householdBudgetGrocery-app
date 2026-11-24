import { useId, useState } from "react"
import { Label } from "@/components/ui/label"
import { StockQuantityInput } from "@/components/stock-quantity-input"

const units = ["kg", "g", "l", "ml", "each"]

export function InventoryStockInputs({
  item,
}: {
  item?: { unit: string; minimum: string }
}) {
  const id = useId()
  const [unit, setUnit] = useState(item?.unit ?? "kg")
  const [initialMinimum, setInitialMinimum] = useState(item?.minimum)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-unit`}>Stock unit</Label>
        <select
          id={`${id}-unit`}
          name="unit"
          className="native-select"
          value={unit}
          onChange={(event) => {
            const nextUnit = event.target.value
            setUnit(nextUnit)
            setInitialMinimum(undefined)
          }}
          required
        >
          {units.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <StockQuantityInput
        key={unit}
        unit={unit}
        name="minimum"
        label="Minimum usable stock"
        initialValue={initialMinimum}
      />
    </div>
  )
}
