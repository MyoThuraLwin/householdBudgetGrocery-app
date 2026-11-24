import type { ImportPreview, PriceObservation } from "@/lib/models"
import { useRef, useState } from "react"
import { useWorkspace } from "@/context"
import { api, money, quantity } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FormDialog,
  DataTable,
  Panel,
  PageTitle,
  Status,
  options,
} from "@/components/workspace"

export function ProductsPage() {
  const w = useWorkspace()
  const [search, setSearch] = useState("")
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [history, setHistory] = useState<PriceObservation[]>([])
  const importKey = useRef(crypto.randomUUID())
  const downloadTemplate = async () => {
    const t = await api<{ rows: unknown[] }>(
      "/price-imports/template?format=json"
    )
    const blob = new Blob([JSON.stringify(t.rows, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "grocery-price-template.json"
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <>
      <PageTitle
        title="Products & prices"
        description="Comparable package prices, with a source and observation date you can check."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                void w.act(downloadTemplate, "Template downloaded")
              }
            >
              Download template
            </Button>
            <FormDialog
              title="Register data source"
              fields={[
                { name: "name", label: "Source name" },
                {
                  name: "type",
                  label: "Source type",
                  options: options([
                    "user",
                    "fixture",
                    "licensed",
                    "official",
                    "authorised-api",
                  ]),
                },
                {
                  name: "permission",
                  label: "Permission or licence notes",
                  type: "textarea",
                },
                {
                  name: "freshnessDays",
                  label: "Freshness threshold (days)",
                  type: "number",
                  value: "7",
                  step: "1",
                  min: "1",
                },
              ]}
              onSubmit={(v) =>
                w.act(
                  () =>
                    api("/data-sources", "POST", {
                      ...v,
                      freshnessDays: Number(v.freshnessDays),
                    }),
                  "Data source registered"
                )
              }
            />
          </div>
        }
      />
      <Panel
        title="Import permitted price data"
        note="CSV or JSON · up to 1,000 rows · preview before committing"
      >
        <div className="p-5">
          <label className="block text-sm font-medium" htmlFor="price-file">
            Select a CSV or JSON price file
          </label>
          <Input
            id="price-file"
            type="file"
            accept=".csv,.json"
            className="mt-2 max-w-lg"
            disabled={w.pending}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file)
                void w.act(async () => {
                  const p = await api<ImportPreview>(
                    "/price-imports/preview",
                    "POST",
                    {
                      format: file.name.endsWith(".csv") ? "csv" : "json",
                      content: await file.text(),
                    }
                  )
                  importKey.current = crypto.randomUUID()
                  setPreview(p)
                }, "Import preview ready")
              event.target.value = ""
            }}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Register the source first. Required columns include source,
            observedAt, store, sku, name, category, packageQuantity, unit, price
            and availability. No supermarket scraping is included.
          </p>
        </div>
        {preview && (
          <div className="border-t p-5">
            <div className="flex items-center justify-between">
              <div>
                <strong>{preview.count} rows reviewed</strong>
                <p className="text-sm text-muted-foreground">
                  {preview.errors.length} validation errors ·{" "}
                  {preview.committed ? "Committed" : "Not yet imported"}
                </p>
              </div>
              <Button
                disabled={
                  w.pending || preview.errors.length > 0 || preview.committed
                }
                onClick={() =>
                  void w.act(
                    async () =>
                      setPreview(
                        await api<ImportPreview>(
                          `/price-imports/${preview.id}/commit`,
                          "POST",
                          { revision: preview.revision },
                          importKey.current
                        )
                      ),
                    "Price snapshots imported"
                  )
                }
              >
                Commit import
              </Button>
            </div>
            {preview.errors.map((e) => (
              <p
                key={e.row + e.message}
                className="mt-2 text-xs text-destructive"
              >
                Row {e.row}: {e.message}
              </p>
            ))}
            {preview.result && (
              <p className="mt-2 text-sm">
                {preview.result.imported} snapshots imported ·{" "}
                {preview.result.duplicates} duplicates skipped
              </p>
            )}
          </div>
        )}
      </Panel>
      <Panel
        title="Price observations"
        note="Demo stores and prices are fictional evaluation data."
        action={
          <Input
            aria-label="Search products"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        }
      >
        <DataTable
          columns={[
            "Product",
            "Store",
            "Package",
            "Price",
            "Unit price",
            "Availability",
            "Observed / source",
            "History",
          ]}
          rows={w.products
            .filter((p) =>
              p.product.name.toLowerCase().includes(search.toLowerCase())
            )
            .map((p) => {
              return [
                <div>
                  <strong>{p.product.name}</strong>
                  <p className="text-xs text-muted-foreground">
                    {p.product.brand} · {p.product.category}
                  </p>
                </div>,
                p.store.name,
                `${quantity(p.packageQuantity)} ${p.unit}`,
                money(p.price),
                p.price === null ? "—" : `${money(p.unitPrice)}/${p.baseUnit}`,
                <Status value={p.availability} />,
                <div className="text-xs">
                  {p.observedAt
                    ? new Date(p.observedAt).toLocaleDateString("en-NZ")
                    : "Unknown"}{" "}
                  {p.stale && <Status value="stale" />}
                  <p className="text-muted-foreground">
                    {p.source ?? "No source"}
                  </p>
                </div>,
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={w.pending}
                  onClick={() =>
                    void w.act(
                      async () =>
                        setHistory(
                          await api<PriceObservation[]>(
                            `/products/${p.productId}/prices`
                          )
                        ),
                      "Price history loaded"
                    )
                  }
                >
                  History
                </Button>,
              ]
            })}
        />
      </Panel>
      {history.length > 0 && (
        <Panel
          title="Observed price history"
          action={
            <Button variant="ghost" onClick={() => setHistory([])}>
              Close
            </Button>
          }
        >
          <DataTable
            columns={["Store", "Observed", "Price", "Source"]}
            rows={history.map((p) => [
              p.listing.store.name,
              new Date(p.observedAt).toLocaleString("en-NZ"),
              money(p.price),
              p.source.name,
            ])}
          />
        </Panel>
      )}
    </>
  )
}
export function StoresPage() {
  const w = useWorkspace()
  return (
    <>
      <PageTitle
        title="Store costs"
        description="Include the costs between a shelf price and your actual shopping total."
        action={
          <FormDialog
            title="Add store"
            fields={[
              { name: "name", label: "Store name" },
              { name: "retailer", label: "Retailer" },
              {
                name: "location",
                label: "Location",
                value: w.household.location,
                required: false,
              },
            ]}
            onSubmit={(v) =>
              w.act(() => api("/stores", "POST", v), "Store added")
            }
          />
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {w.stores.map((store) => (
          <Panel
            key={store.id}
            title={store.name}
            note={`${store.retailer} · ${store.location}`}
            action={
              <FormDialog
                title="Set fulfilment costs"
                fields={[
                  {
                    name: "mode",
                    label: "Fulfilment mode",
                    options: options(["pickup", "delivery"]),
                  },
                  {
                    name: "minimum",
                    label: "Minimum merchandise order (NZD)",
                    type: "number",
                    min: "0",
                    value: "0",
                  },
                  {
                    name: "delivery",
                    label: "Delivery charge (blank = unknown)",
                    type: "number",
                    min: "0",
                    value: "0",
                    required: false,
                  },
                  {
                    name: "freeThreshold",
                    label: "Free delivery threshold (optional)",
                    type: "number",
                    min: "0",
                    required: false,
                  },
                  {
                    name: "travel",
                    label: "Travel cost per visited store (NZD)",
                    type: "number",
                    min: "0",
                    value: "0",
                  },
                  {
                    name: "source",
                    label: "Rule source or assumption",
                    value: "User-entered assumption",
                  },
                ]}
                onSubmit={(v) => {
                  const old = store.rules.find((r) => r.mode === v.mode)
                  return w.act(
                    () =>
                      api(`/stores/${store.id}/fulfilment-rules`, "PUT", {
                        ...v,
                        delivery: v.delivery || null,
                        freeThreshold: v.freeThreshold || null,
                        revision: old?.revision,
                      }),
                    "Store costs saved"
                  )
                }}
              >
                Set costs
              </FormDialog>
            }
          >
            <DataTable
              columns={["Mode", "Minimum", "Delivery", "Free above", "Travel"]}
              rows={store.rules.map((r) => [
                <Status value={r.mode} />,
                money(r.minimum),
                r.delivery === null ? "Unknown" : money(r.delivery),
                money(r.freeThreshold),
                money(r.travel),
              ])}
            />
            <div className="px-5 pb-4 text-xs text-muted-foreground">
              {store.rules.map((r) => (
                <p key={r.id}>
                  {r.mode}: {r.source} ·{" "}
                  {new Date(r.observedAt).toLocaleDateString("en-NZ")}
                </p>
              ))}
            </div>
          </Panel>
        ))}
      </div>
      <p className="quiet-note">
        Charges apply once per used store. Free-delivery thresholds use the
        merchandise subtotal. Travel values are your assumptions; this
        application does not calculate routes.
      </p>
    </>
  )
}
