import { useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Sparkles, UserRound } from 'lucide-react'
import { Logo } from '../components/ui'
import { sanitizeUserMessage } from '../lib/userMessage'

export function LoginPage({ onLogin, onDemo, showDemo }: { onLogin: (username: string, password: string) => void | Promise<void>; onDemo: () => void; showDemo: boolean }) {
  const [showPassword, setShowPassword] = useState(false)
  const [username, setUsername] = useState('arunika')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!username.trim() || !password.trim()) { setError('Masukkan username dan password Anda.'); return }
    try {
      setError('')
      await onLogin(username, password)
    } catch (loginError) {
      setError(loginError instanceof Error ? sanitizeUserMessage(loginError.message) : 'Tidak dapat masuk saat ini.')
    }
  }
  return (
    <main className="login-page">
      <section className="login-showcase">
        <div className="login-showcase-top"><Logo /><span className="login-badge"><Sparkles size={14} /> Creative ops, calm.</span></div>
        <div className="login-showcase-copy"><p className="eyebrow">Your creative command center</p><h1>Kerja lebih jernih.<br /><i>Proyek lebih terasa ringan.</i></h1><p>Satu ruang tenang untuk brief, timeline, pembayaran, dan klien Anda.</p></div>
        <div className="login-feature-list" aria-label="Fitur utama Nayagement"><span><CheckCircle2 size={16} /> Proyek, task, dan deadline dalam satu alur</span><span><CheckCircle2 size={16} /> Invoice dan pembayaran tercatat rapi</span><span><CheckCircle2 size={16} /> Portal klien selalu mengikuti data terbaru</span></div>
        <p className="login-footer-copy">Dirancang untuk freelancer, studio, dan tim kreatif kecil.</p>
      </section>
      <section className="login-panel"><div className="login-mobile-logo"><Logo /></div><div className="login-form-wrap"><p className="eyebrow">Private workspace</p><h2>Selamat datang kembali</h2><p>Masuk untuk melanjutkan ke ruang kerja Anda.</p><form onSubmit={submit}><label><span><UserRound size={16} /> Username</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" /></label><label><span><LockKeyhole size={16} /> Password</span><div className="password-field"><input autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>{error && <p className="form-error">{error}</p>}<button className="primary-button login-submit" type="submit">Masuk ke workspace <ArrowRight size={18} /></button></form>{showDemo && <button className="login-demo-link" onClick={onDemo}><Sparkles size={15} /> Buka workspace lokal</button>}<div className="login-security-note"><LockKeyhole size={15} /><span>Workspace Anda terlindungi dengan sesi aman.</span></div></div></section>
    </main>
  )
}
