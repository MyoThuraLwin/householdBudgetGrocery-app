import type {
  InventoryItem,
  ListItem,
  GenerationPreview,
  PriceComparison,
} from "@/lib/models"
import { useState } from "react"
import { useWorkspace } from "@/context"
import { api, money, localDate, quantity } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { InventoryStockInputs } from "@/components/inventory-stock-inputs"
import { StockQuantityInput } from "@/components/stock-quantity-input"
import { productCategories } from "@/lib/product-categories"
import {
  FormDialog,
  DataTable,
  Panel,
  PageTitle,
  Status,
  options,
  type Field,
} from "@/components/workspace"

const units = options(["kg", "g", "l", "ml", "each"])
export function InventoryPage() {
  const w = useWorkspace()
  const categories = options([
    ...new Set([
      ...productCategories,
      ...w.inventory.map((item) => item.category),
      ...w.products.map((listing) => listing.product.category),
    ]),
  ])
  const [filter, setFilter] = useState("all")
  const fields = (i?: InventoryItem): Field[] => [
    { name: "name", label: "Item name", value: i?.name },
    {
      name: "category",
      label: "Category",
      value: i?.category ?? "Pantry",
      options:
        i?.category && !categories.some((option) => option.value === i.category)
          ? [{ value: i.category, label: i.category }, ...categories]
          : categories,
    },
    {
      name: "unit",
      label: "Stock unit",
      render: <InventoryStockInputs item={i} />,
    },
  ]
  const items = w.inventory.filter(
    (i) =>
      filter === "all" ||
      (filter === "low" && Number(i.needed) > 0) ||
      i.batches.some((b) => b.status === filter && Number(b.quantity) > 0)
  )
  return (
    <>
      <PageTitle
        title="Kitchen inventory"
        description="Know what you have, what to use soon and what needs a top-up."
        action={
          <FormDialog
            title="Add inventory item"
            fields={fields()}
            onSubmit={(v) =>
              w.act(
                () => api("/inventory/items", "POST", v),
                "Inventory item added"
              )
            }
          />
        }
      />
      <div className="filter-row">
        {[
          ["all", "All items"],
          ["low", "Low stock"],
          ["soon", "Use soon"],
          ["expired", "Past date"],
          ["unknown", "Unknown date"],
        ].map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "default" : "outline"}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <Panel
        title="Your kitchen"
        note="Batches with different dates stay separate. Date labels do not determine food safety."
      >
        <DataTable
          columns={[
            "Item",
            "Usable stock",
            "Minimum",
            "Batches & dates",
            "Actions",
          ]}
          rows={items.map((i) => [
            <div>
              <strong>{i.name}</strong>
              <p className="text-xs text-muted-foreground">{i.category}</p>
            </div>,
            `${quantity(i.usable)} ${i.unit}`,
            <span className={Number(i.needed) > 0 ? "text-amber-700" : ""}>
              {quantity(i.minimum)} {i.unit}
            </span>,
            <div className="space-y-2">
              {i.batches
                .filter((b) => Number(b.quantity) > 0)
                .map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center gap-2 text-xs"
                  >
                    <span>
                      {quantity(b.quantity)} {i.unit} ·{" "}
                      {b.expiryDate ?? "Date unknown"}
                    </span>
                    <Status
                      value={b.status === "soon" ? "use soon" : b.status}
                    />
                  </div>
                ))}
            </div>,
            <div className="flex flex-wrap gap-2">
              <FormDialog
                title="Add stock batch"
                fields={[
                  {
                    name: "quantity",
                    label: `Quantity (${i.unit})`,
                    render: (
                      <StockQuantityInput
                        unit={i.unit}
                        name="quantity"
                        label={`Quantity (${i.unit})`}
                        positive
                      />
                    ),
                  },
                  {
                    name: "acquiredOn",
                    label: "Purchase or acquisition date",
                    type: "date",
                    value: localDate(),
                  },
                  {
                    name: "expiryDate",
                    label: "Expiry / best-before date (optional)",
                    type: "date",
                    required: false,
                  },
                  {
                    name: "dateLabel",
                    label: "Date label",
                    options: options(["best-before", "use-by", "unknown"]),
                  },
                ]}
                onSubmit={(v) =>
                  w.act(
                    () =>
                      api(`/inventory/items/${i.id}/batches`, "POST", {
                        ...v,
                        expiryDate: v.expiryDate || null,
                        revision: i.revision,
                      }),
                    "Stock added"
                  )
                }
              >
                Add stock
              </FormDialog>
              <FormDialog
                title="Use or discard stock"
                disabled={!i.batches.some((b) => Number(b.quantity) > 0)}
                fields={[
                  {
                    name: "batchId",
                    label: "Batch (review the date)",
                    options: [...i.batches]
                      .filter((b) => Number(b.quantity) > 0)
                      .sort(
                        (a, b) =>
                          (a.status === "expired" ? 1 : 0) -
                            (b.status === "expired" ? 1 : 0) ||
                          (a.expiryDate ?? "9999").localeCompare(
                            b.expiryDate ?? "9999"
                          )
                      )
                      .map((b) => ({
                        value: b.id,
                        label: `${quantity(b.quantity)} ${i.unit} · ${b.expiryDate ?? "unknown date"} · ${b.status}`,
                      })),
                  },
                  {
                    name: "quantity",
                    label: `Amount to remove (${i.unit})`,
                    type: "number",
                    min: "0.000001",
                    step: "0.000001",
                    value: "0.25",
                  },
                  {
                    name: "reason",
                    label: "Reason",
                    options: options(["Consumed", "Waste", "Correction"]),
                  },
                  {
                    name: "expiredAcknowledged",
                    label: "I have reviewed any expired batch",
                    type: "checkbox",
                  },
                ]}
                onSubmit={(v) => {
                  const batch = i.batches.find((b) => b.id === v.batchId)!
                  return w.act(
                    () =>
                      api(`/inventory/batches/${batch.id}/movements`, "POST", {
                        quantity: "-" + v.quantity,
                        reason: v.reason,
                        expiredAcknowledged: v.expiredAcknowledged,
                        revision: batch.revision,
                      }),
                    "Stock movement recorded"
                  )
                }}
              >
                Use / discard
              </FormDialog>
              <FormDialog
                title="Edit inventory item"
                fields={fields(i)}
                onSubmit={(v) =>
                  w.act(
                    () =>
                      api(`/inventory/items/${i.id}`, "PATCH", {
                        ...v,
                        productId: i.productId,
                        revision: i.revision,
                      }),
                    "Inventory item updated"
                  )
                }
              >
                Edit
              </FormDialog>
              <FormDialog
                title="Stock movement history"
                label="Close"
                fields={[]}
                description={
                  i.batches
                    .flatMap((b) =>
                      (b.movements ?? []).map(
                        (m) =>
                          `${m.reason}: ${Number(m.quantity)} ${i.unit} (${b.expiryDate ?? "no expiry"})`
                      )
                    )
                    .join(" · ") || "No movements recorded."
                }
                onSubmit={async () => {}}
              >
                History
              </FormDialog>
            </div>,
          ])}
        />
      </Panel>
    </>
  )
}
export function ListsPage() {
  const w = useWorkspace()
  const [selected, setSelected] = useState("")
  const [preview, setPreview] = useState<GenerationPreview | null>(null)
  const [comparison, setComparison] = useState<PriceComparison | null>(null)
  const list = w.lists.find((l) => l.id === selected) ?? w.lists[0]
  const productOptions = [
    { value: "", label: "Unmatched — choose later" },
    ...Array.from(
      new Map(
        w.products.map((p) => [
          p.productId,
          {
            value: p.productId,
            label: `${p.product.name} · ${p.product.category}`,
          },
        ])
      ).values()
    ),
  ]
  const itemFields = (i?: ListItem): Field[] => [
    { name: "name", label: "Item name", value: i?.name },
    { name: "category", label: "Category", value: i?.category ?? "Pantry" },
    {
      name: "quantity",
      label: "Required quantity",
      type: "number",
      min: "0.000001",
      step: "0.000001",
      value: i?.quantity ?? "1",
    },
    { name: "unit", label: "Unit", options: units, value: i?.unit ?? "kg" },
    {
      name: "priority",
      label: "Priority",
      options: options(["high", "normal", "low"]),
      value: i?.priority ?? "normal",
    },
    {
      name: "productId",
      label: "Confirmed catalogue product",
      options: productOptions,
      value: i?.productId ?? "",
      required: false,
      hint: "Choose a compatible category and unit. Leaving this blank keeps the item unmatched.",
    },
  ]
  return (
    <>
      <PageTitle
        title="Shopping lists"
        description="Start with your kitchen, then make room for what you need."
        action={
          <FormDialog
            title="New shopping list"
            fields={[
              { name: "name", label: "List name", value: "Weekly essentials" },
            ]}
            onSubmit={(v) =>
              w.act(async () => {
                const result = await api<{ id: string }>(
                  "/shopping-lists",
                  "POST",
                  v
                )
                setSelected(result.id)
                return result
              }, "Shopping list created")
            }
          />
        }
      />
      {list ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <select
              className="native-select max-w-xs"
              aria-label="Shopping list"
              value={list.id}
              onChange={(e) => {
                setSelected(e.target.value)
                setPreview(null)
                setComparison(null)
              }}
            >
              {w.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={w.pending}
                onClick={() =>
                  void w.act(async () => {
                    const p = await api<GenerationPreview>(
                      `/shopping-lists/${list.id}/generation-preview`,
                      "POST",
                      { revision: list.revision }
                    )
                    setPreview(p)
                  }, "Replenishment preview ready")
                }
              >
                Generate from inventory
              </Button>
              <Button
                variant="outline"
                disabled={w.pending}
                onClick={() =>
                  void w.act(async () => {
                    const c = await api<PriceComparison>(
                      "/price-comparisons",
                      "POST",
                      {
                        listId: list.id,
                      }
                    )
                    setComparison(c)
                  }, "Price comparison ready")
                }
              >
                Compare prices
              </Button>
              <Button onClick={() => w.navigate("plans")}>
                Optimise list ↗
              </Button>
            </div>
          </div>
          {preview && (
            <Panel
              title="Proposed replenishment"
              note="Existing manual entries and edits are preserved. Review before applying."
              action={
                <Button
                  disabled={w.pending}
                  onClick={() =>
                    void w.act(async () => {
                      await api(
                        `/shopping-lists/${list.id}/apply-generation`,
                        "POST",
                        { revision: list.revision, previewId: preview.id }
                      )
                      setPreview(null)
                    }, "Replenishment applied")
                  }
                >
                  Apply {preview.proposed.length} additions
                </Button>
              }
            >
              <DataTable
                columns={["Item", "Quantity", "Origin"]}
                rows={preview.proposed.map((i) => [
                  i.name,
                  `${quantity(i.quantity)} ${i.unit}`,
                  "Low usable stock",
                ])}
                empty="Your existing list already covers the proposed additions."
              />
              {preview.quantityRequired?.length > 0 && (
                <p className="p-5 text-sm text-amber-700">
                  Expired stock without a target quantity:{" "}
                  {preview.quantityRequired.map((i) => i.name).join(", ")}. Add
                  a list item with your chosen quantity or set a minimum
                  inventory level.
                </p>
              )}
            </Panel>
          )}
          <Panel
            title={list.name}
            note={`${list.items.length} items · Changes require a fresh shopping comparison.`}
            action={
              <div className="flex gap-2">
                <FormDialog
                  title="Rename list"
                  fields={[{ name: "name", label: "Name", value: list.name }]}
                  onSubmit={(v) =>
                    w.act(
                      () =>
                        api(`/shopping-lists/${list.id}`, "PATCH", {
                          ...v,
                          revision: list.revision,
                        }),
                      "List renamed"
                    )
                  }
                />
                <FormDialog
                  title="Add list item"
                  fields={itemFields()}
                  onSubmit={(v) =>
                    w.act(
                      () =>
                        api(`/shopping-lists/${list.id}/items`, "POST", {
                          ...v,
                          productId: v.productId || null,
                          revision: list.revision,
                        }),
                      "Item added"
                    )
                  }
                />
              </div>
            }
          >
            <DataTable
              columns={[
                "Item",
                "Required",
                "Priority",
                "Product match",
                "Actions",
              ]}
              rows={list.items.map((i) => [
                <div>
                  <strong>{i.name}</strong>
                  <p className="text-xs text-muted-foreground">
                    {i.category} · {i.origin}
                  </p>
                </div>,
                `${quantity(i.quantity)} ${i.unit}`,
                <Status value={i.priority} />,
                i.productId ? (
                  (w.products.find((p) => p.productId === i.productId)?.product
                    .name ?? "Confirmed product")
                ) : (
                  <Status value="unmatched" />
                ),
                <div className="flex gap-2">
                  <FormDialog
                    title="Edit list item"
                    fields={itemFields(i)}
                    onSubmit={(v) =>
                      w.act(
                        () =>
                          api(`/shopping-list-items/${i.id}`, "PATCH", {
                            ...v,
                            inventoryItemId: i.inventoryItemId,
                            productId: v.productId || null,
                            revision: list.revision,
                            origin: "manual",
                          }),
                        "List item updated"
                      )
                    }
                  >
                    Edit / match
                  </FormDialog>
                  <FormDialog
                    title="Remove list item"
                    fields={[]}
                    description={`Remove ${i.name}? Saved plans will need recalculation.`}
                    label="Remove item"
                    onSubmit={() =>
                      w.act(
                        () =>
                          api(`/shopping-list-items/${i.id}`, "DELETE", {
                            revision: list.revision,
                          }),
                        "Item removed"
                      )
                    }
                  >
                    Remove
                  </FormDialog>
                </div>,
              ])}
            />
          </Panel>
          {comparison && (
            <Panel
              title="Quantity-aware price comparison"
              note="Whole packages, using fresh available observations and your confirmed matches."
            >
              <DataTable
                columns={[
                  "Item",
                  "Store",
                  "Packs",
                  "Purchased",
                  "Excess",
                  "Payable cost",
                  "Source",
                ]}
                rows={comparison.candidates.map((c) => [
                  c.name,
                  c.storeName,
                  c.packs,
                  `${quantity(c.purchased)} ${c.unit}`,
                  `${quantity(c.excess)} ${c.unit}`,
                  money(c.cost),
                  <div className="text-xs">
                    {c.source}
                    <p>{new Date(c.observedAt).toLocaleDateString("en-NZ")}</p>
                  </div>,
                ])}
              />
              {comparison.unmatched.length > 0 && (
                <p className="p-5 text-sm text-amber-700">
                  Unmatched:{" "}
                  {comparison.unmatched.map((i) => i.name).join(", ")}. Review
                  product matches, units and price freshness.
                </p>
              )}
            </Panel>
          )}
        </>
      ) : (
        <Panel title="Start your first list">
          <div className="p-6 text-muted-foreground">
            Create a shopping list, add items manually or generate replenishment
            from inventory.
          </div>
        </Panel>
      )}
    </>
  )
}
