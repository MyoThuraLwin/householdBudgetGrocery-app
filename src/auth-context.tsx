import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import {
  api,
  ApiError,
  pendingRefresh,
  refreshSession,
  setAccessToken,
  type AuthResult,
  type AuthUser,
} from "@/lib/api"

type Credentials = { email: string; password: string }
type Registration = Credentials & { name: string; householdName: string }
type AuthState = {
  user: AuthUser | null
  loading: boolean
  error: string
  login: (input: Credentials) => Promise<void>
  register: (input: Registration) => Promise<void>
  logout: () => Promise<void>
}
const AuthContext = createContext<AuthState | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    refreshSession()
      .then((session) => {
        if (active) setUser(session.user)
      })
      .catch((e) => {
        if (active && !(e instanceof ApiError && e.status === 401))
          setError((e as Error).message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    const signedOut = () => {
      setUser(null)
      setError("Your session ended. Please sign in again.")
    }
    const accountChanged = (event: Event) => {
      setUser((event as CustomEvent<AuthUser>).detail)
      setError("")
    }
    window.addEventListener("homewise:signed-out", signedOut)
    window.addEventListener("homewise:account-changed", accountChanged)
    return () => {
      active = false
      window.removeEventListener("homewise:signed-out", signedOut)
      window.removeEventListener("homewise:account-changed", accountChanged)
    }
  }, [])
  const authenticate = async (
    path: string,
    input: Credentials | Registration
  ) => {
    await pendingRefresh()
    const session = await api<AuthResult>(path, "POST", input)
    setAccessToken(session.accessToken, session.user.id)
    setError("")
    setUser(session.user)
  }
  const logout = async () => {
    await pendingRefresh()
    await api("/auth/logout", "POST", {})
    setAccessToken(null)
    setUser(null)
    setError("")
  }
  return (
    <AuthContext
      value={{
        user,
        loading,
        error,
        login: (input) => authenticate("/auth/login", input),
        register: (input) => authenticate("/auth/register", input),
        logout,
      }}
    >
      {children}
    </AuthContext>
  )
}
export function useAuth() {
  const state = useContext(AuthContext)
  if (!state) throw new Error("Authentication provider is missing.")
  return state
}
