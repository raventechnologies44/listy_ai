import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'
import type { Profile } from '../types/database'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  profileLoading: boolean
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (updates: Partial<Pick<Profile, 'full_name' | 'phone' | 'brokerage'>>) => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setProfileLoading(false)
    if (error) {
      console.error(error)
      setProfile(null)
      return
    }
    setProfile(data as Profile | null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user?.id) await fetchProfile(user.id)
  }, [fetchProfile, user?.id])

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      return
    }

    let mounted = true

    // Register the auth listener first so a refresh/token event cannot be
    // missed while the initial persisted session is being restored.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)

      if (event === 'SIGNED_OUT' || !nextSession?.user) {
        setProfile(null)
        setProfileLoading(false)
        return
      }

      // Token refreshes should update the session only. Re-fetching the profile
      // on every TOKEN_REFRESHED event can cause unnecessary render/request loops,
      // especially on data-heavy dashboard pages.
      if (event === 'SIGNED_IN') {
        window.setTimeout(() => {
          if (mounted) void fetchProfile(nextSession.user.id)
        }, 0)
      }
    })

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error) {
        console.error('Could not restore Supabase session:', error)
      }
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
      if (data.session?.user) {
        void fetchProfile(data.session.user.id)
      } else {
        setProfile(null)
        setProfileLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      if (!supabaseConfigured) return 'Supabase is not configured. Add credentials to .env.local.'
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() } },
      })
      return error?.message ?? null
    },
    [],
  )

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabaseConfigured) return 'Supabase is not configured. Add credentials to .env.local.'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }, [])

  const updateProfile = useCallback(
    async (updates: Partial<Pick<Profile, 'full_name' | 'phone' | 'brokerage'>>) => {
      if (!user) return 'Not signed in'
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
      if (error) return error.message
      await fetchProfile(user.id)
      return null
    },
    [fetchProfile, user],
  )

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      profileLoading,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      updateProfile,
    }),
    [
      session,
      user,
      profile,
      loading,
      profileLoading,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      updateProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
