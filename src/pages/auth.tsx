import { useState } from "react"
import { useAuth } from "@/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

const demoPassword = "HomewiseDemo!2026"
const demos = [
  {
    email: "admin@homewise.demo",
    name: "Administrator",
    note: "Manage accounts and explore household features",
  },
  {
    email: "alice@homewise.demo",
    name: "Alice household",
    note: "A private household with sample data",
  },
  {
    email: "ben@homewise.demo",
    name: "Ben household",
    note: "A second household to check data separation",
  },
]
export function AuthPage() {
  const auth = useAuth()
  const [register, setRegister] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  return (
    <div className="auth-shell">
      <div className="auth-story">
        <a className="auth-wordmark" href="#overview">
          ⌂ homewise.
        </a>
        <div>
          <p className="auth-eyebrow">A HOME THAT WORKS FOR YOU</p>
          <h1>
            A little planning.
            <br />
            More room to live.
          </h1>
          <p>
            Bring your household budget, kitchen inventory and next grocery shop
            together in one place.
          </p>
          <div className="auth-story-card">
            <span>One connected household</span>
            <strong>Budget → Kitchen → Shopping</strong>
            <p>Your household records stay in your own workspace.</p>
          </div>
        </div>
        <small>Thoughtful everyday decisions, together.</small>
      </div>
      <main className="auth-main">
        <Card className="auth-card">
          <CardContent className="p-7 sm:p-9">
            <div className="auth-mode">
              <button
                type="button"
                aria-pressed={!register}
                className={!register ? "selected" : ""}
                onClick={() => {
                  setRegister(false)
                  setError("")
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                aria-pressed={register}
                className={register ? "selected" : ""}
                onClick={() => {
                  setRegister(true)
                  setError("")
                }}
              >
                Create account
              </button>
            </div>
            <h2>{register ? "Start your household." : "Welcome home."}</h2>
            <p className="auth-subtitle">
              {register
                ? "Create your account and a private household workspace."
                : "Sign in to pick up where you left off."}
            </p>
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                setError("")
                if (register && password !== data.get("confirmPassword")) {
                  setError("The passwords do not match.")
                  return
                }
                setBusy(true)
                try {
                  if (register)
                    await auth.register({
                      email,
                      password,
                      name: String(data.get("name")),
                      householdName: String(data.get("householdName")),
                    })
                  else await auth.login({ email, password })
                } catch (e) {
                  setError((e as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {register && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="full-name">Your name</Label>
                    <Input
                      id="full-name"
                      name="name"
                      autoComplete="name"
                      maxLength={120}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="household-name">Household name</Label>
                    <Input
                      id="household-name"
                      name="householdName"
                      autoComplete="organization"
                      maxLength={120}
                      placeholder="e.g. Taylor household"
                      required
                    />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="auth-email">Email address</Label>
                <Input
                  id="auth-email"
                  type="email"
                  name="email"
                  autoComplete="username"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="auth-password">Password</Label>
                <Input
                  id="auth-password"
                  type="password"
                  name="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  minLength={register ? 12 : 1}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {register && (
                  <p className="text-xs text-muted-foreground">
                    Use at least 12 characters.
                  </p>
                )}
              </div>
              {register && (
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    required
                  />
                </div>
              )}
              {(error || auth.error) && (
                <p
                  role="alert"
                  className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {error || auth.error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : register
                    ? "Create my household"
                    : "Sign in"}
              </Button>
            </form>
            {!register && import.meta.env.DEV && (
              <div className="demo-accounts">
                <p className="font-medium">Explore with a demo account</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Choose an account to fill the form, then sign in.
                </p>
                {demos.map((demo) => (
                  <button
                    type="button"
                    key={demo.email}
                    disabled={busy}
                    onClick={() => {
                      setEmail(demo.email)
                      setPassword(demoPassword)
                      setError("")
                    }}
                  >
                    <span>
                      <strong>{demo.name}</strong>
                      <small>{demo.note}</small>
                    </span>
                    <span aria-hidden>↗</span>
                  </button>
                ))}
                <p className="mt-3 text-xs text-muted-foreground">
                  Local demo password: <code>{demoPassword}</code>
                </p>
              </div>
            )}
            <p className="mt-6 text-center text-xs text-muted-foreground">
              A private space for everyday planning.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
