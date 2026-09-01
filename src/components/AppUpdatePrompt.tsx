import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, Sparkles, X } from 'lucide-react'

const pendingUpdateKey = 'nayagement-pending-app-update'
const updateCheckInterval = 45_000

type VersionManifest = {
  version?: string
  builtAt?: string
}

type AppUpdatePromptProps = {
  onUpdated: () => void
}

type PendingUpdate = {
  from: string
  to: string
}

function versionManifestUrl() {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
  return `${base}app-version.json?t=${Date.now()}`
}

export function AppUpdatePrompt({ onUpdated }: AppUpdatePromptProps) {
  const [availableVersion, setAvailableVersion] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const dismissedVersion = useRef('')

  const checkForUpdate = useCallback(async () => {
    if (!import.meta.env.PROD || document.visibilityState === 'hidden') return

    try {
      const response = await fetch(versionManifestUrl(), {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) return

      const manifest = await response.json() as VersionManifest
      const nextVersion = typeof manifest.version === 'string' ? manifest.version.trim() : ''
      if (nextVersion && nextVersion !== __APP_VERSION__ && nextVersion !== dismissedVersion.current) {
        setAvailableVersion(nextVersion)
      }
    } catch {
      // Pemeriksaan berjalan diam-diam agar gangguan jaringan tidak mengusik UI.
    }
  }, [])

  useEffect(() => {
    if (!import.meta.env.PROD) return

    try {
      const pendingValue = window.sessionStorage.getItem(pendingUpdateKey)
      const pendingUpdate = pendingValue ? JSON.parse(pendingValue) as PendingUpdate : null
      if (pendingUpdate?.from && pendingUpdate.from !== __APP_VERSION__) {
        window.sessionStorage.removeItem(pendingUpdateKey)
        onUpdated()
      }
    } catch {
      // Session storage dapat dinonaktifkan oleh browser; update tetap berfungsi.
    }

    void checkForUpdate()
    const interval = window.setInterval(() => { void checkForUpdate() }, updateCheckInterval)
    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') void checkForUpdate()
    }
    const checkWhenOnline = () => { void checkForUpdate() }

    document.addEventListener('visibilitychange', checkWhenVisible)
    window.addEventListener('focus', checkWhenOnline)
    window.addEventListener('online', checkWhenOnline)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', checkWhenVisible)
      window.removeEventListener('focus', checkWhenOnline)
      window.removeEventListener('online', checkWhenOnline)
    }
  }, [checkForUpdate, onUpdated])

  const dismiss = () => {
    dismissedVersion.current = availableVersion
    setAvailableVersion('')
  }

  const refreshApp = async () => {
    if (!availableVersion || refreshing) return
    setRefreshing(true)
    try {
      window.sessionStorage.setItem(pendingUpdateKey, JSON.stringify({ from: __APP_VERSION__, to: availableVersion }))
    } catch {
      // Reload tetap dilakukan jika session storage tidak tersedia.
    }

    try {
      const registration = await navigator.serviceWorker?.getRegistration()
      await registration?.update()
    } catch {
      // Network-first service worker tetap akan meminta bundle terbaru saat reload.
    }
    window.location.reload()
  }

  if (!availableVersion) return null

  return (
    <section className="app-update-prompt" role="alertdialog" aria-live="assertive" aria-labelledby="app-update-title" aria-describedby="app-update-description">
      <span className="app-update-icon" aria-hidden="true"><Sparkles size={20} /></span>
      <div className="app-update-copy">
        <strong id="app-update-title">Pembaruan tersedia</strong>
        <span id="app-update-description">Versi terbaru Nayagement sudah siap digunakan.</span>
      </div>
      <div className="app-update-actions">
        <button type="button" className="app-update-later" onClick={dismiss}>Nanti</button>
        <button type="button" className="app-update-refresh" onClick={() => { void refreshApp() }} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
          {refreshing ? 'Memperbarui…' : 'Perbarui sekarang'}
        </button>
      </div>
      <button type="button" className="app-update-close" aria-label="Tutup pemberitahuan pembaruan" onClick={dismiss}><X size={17} /></button>
    </section>
  )
}
