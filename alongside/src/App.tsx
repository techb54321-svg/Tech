import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { useNavigate, useRoute } from './route'
import { ParentApp } from './parent/ParentApp'
import { FamilyApp } from './family/FamilyApp'
import { Welcome, PairDevice } from './Welcome'
import { Showcase } from './Showcase'

export interface Me {
  family: {
    name: string
    email: string | null
    isDemo: boolean
    households: Array<{ id: string; parentName: string; isDemo: boolean }>
  } | null
  parent: { householdId: string; parentName: string; isDemo: boolean } | null
}

export function App() {
  const path = useRoute()
  const [me, setMe] = useState<Me | null>(null)
  const [failed, setFailed] = useState(false)

  const reload = useCallback(async () => {
    try {
      setMe(await api<Me>('GET', '/api/auth/me'))
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  if (failed && !me) {
    return (
      <div className="w-wrap" role="alert">
        <h1>Can’t connect</h1>
        <p>Alongside could not reach its server. Check the internet connection.</p>
        <button className="big-btn blue medium" onClick={reload}>
          Try again
        </button>
      </div>
    )
  }
  if (!me) {
    return (
      <div className="w-wrap" aria-busy="true">
        <p className="p-body">Loading…</p>
      </div>
    )
  }

  if (path === '/both' && me.parent && me.family?.isDemo) return <Showcase me={me} />
  if (path.startsWith('/family')) return <FamilyApp me={me} path={path} reloadMe={reload} />
  if (path === '/pair') return <PairDevice onPaired={reload} />
  if (path === '/welcome' || (!me.parent && !me.family)) return <Welcome reloadMe={reload} />
  if (me.parent) return <ParentApp path={path} onSignedOut={reload} />
  // Signed-in family member on their own device: go to the family area.
  return <Redirect to="/family" />
}

function Redirect({ to }: { to: string }) {
  const navigate = useNavigate()
  useEffect(() => navigate(to, true), [navigate, to])
  return null
}
