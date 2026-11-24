import type { components } from "./api-schema"
export type Summary = components["schemas"]["Summary"]
export type Inventory = components["schemas"]["Inventory"]
export type ShoppingList = components["schemas"]["List"]
export type Household = components["schemas"]["Household"]
export type Budget = components["schemas"]["Budget"]
export type AuthUser = components["schemas"]["User"]
export type AuthResult = components["schemas"]["AuthResult"]
let accessToken: string | null = null
let activeUserId: string | null = null
let authGeneration = 0
let refreshRequest: Promise<AuthResult> | null = null
export const setAccessToken = (token: string | null, userId?: string) => {
  accessToken = token
  activeUserId = token ? (userId ?? null) : null
  authGeneration++
}
export const pendingRefresh = async () => {
  await refreshRequest?.catch(() => {})
}
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}
export function refreshSession(): Promise<AuthResult> {
  if (!refreshRequest) {
    const generation = authGeneration
    refreshRequest = api<AuthResult>("/auth/refresh", "POST", {})
      .then((result) => {
        if (generation !== authGeneration)
          throw new ApiError("The signed-in account changed.", 409)
        accessToken = result.accessToken
        if (activeUserId && activeUserId !== result.user.id) {
          authGeneration++
          window.dispatchEvent(
            new CustomEvent("homewise:account-changed", { detail: result.user })
          )
        }
        activeUserId = result.user.id
        return result
      })
      .finally(() => {
        refreshRequest = null
      })
  }
  return refreshRequest
}
export const money = (value: string | number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("en-NZ", {
        style: "currency",
        currency: "NZD",
      }).format(Number(value))
export const quantity = (value: string | number) =>
  Number(value).toLocaleString("en-NZ", { maximumFractionDigits: 4 })
export const localDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Pacific/Auckland",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
export async function api<T = unknown>(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string
): Promise<T> {
  const generation = authGeneration
  const send = () =>
    fetch((import.meta.env.VITE_API_URL ?? "") + "/api/v1" + path, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  let response = await send()
  if (response.status === 401 && !path.startsWith("/auth/")) {
    try {
      await refreshSession()
      response = await send()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setAccessToken(null)
        window.dispatchEvent(new Event("homewise:signed-out"))
      }
      throw e
    }
    if (response.status === 401) {
      setAccessToken(null)
      window.dispatchEvent(new Event("homewise:signed-out"))
    }
  }
  if (generation !== authGeneration)
    throw new ApiError("The signed-in account changed. Please retry.", 409)
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    const details = json.error?.details
      ?.map?.(
        (i: { path?: (string | number)[]; message: string }) =>
          `${i.path?.join(".") ?? ""}: ${i.message}`
      )
      .join(" · ")
    throw new ApiError(
      details || json.error?.message || `Request failed (${response.status}).`,
      response.status
    )
  }
  return json as T
}

export async function apiAll<T = unknown>(path: string): Promise<T[]> {
  const records: T[] = []
  for (let page = 1; page <= 100; page++) {
    const batch = await api<T[]>(
      `${path}${path.includes("?") ? "&" : "?"}page=${page}&pageSize=500`
    )
    records.push(...batch)
    if (batch.length < 500) return records
  }
  throw new Error(
    "This collection exceeds the prototype limit. Narrow the data selection."
  )
}
