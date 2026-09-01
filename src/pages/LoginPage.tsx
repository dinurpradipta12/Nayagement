import { useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Sparkles, UserRound } from 'lucide-react'
import { Logo } from '../components/ui'
import { sanitizeUserMessage } from '../lib/userMessage'

export function LoginPage({ onLogin, onDemo, showDemo, showPortal = true, onOpenPortal }: { onLogin: (username: string, password: string) => void | Promise<void>; onDemo: () => void; showDemo: boolean; showPortal?: boolean; onOpenPortal: () => void }) {
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
        <div className="login-mockup"><div className="login-mockup-head"><span>Hari ini</span><span><i /><i /><i /></span></div><div className="login-mockup-title"><strong>4</strong><span>proyek<br />aktif</span><em>+24%</em></div><div className="login-mockup-chart"><span style={{ height: '38%' }} /><span style={{ height: '53%' }} /><span style={{ height: '45%' }} /><span style={{ height: '74%' }} /><span style={{ height: '63%' }} /><span className="today-bar" style={{ height: '88%' }} /></div><div className="login-mockup-task"><span><CheckCircle2 size={15} /></span><div><strong>Aurora brand direction</strong><small>Hari ini · 16.00</small></div><em>72%</em></div></div>
        <p className="login-footer-copy">Dirancang untuk freelancer, studio, dan tim kreatif kecil.</p>
      </section>
      <section className="login-panel"><div className="login-mobile-logo"><Logo /></div><div className="login-form-wrap"><p className="eyebrow">Private workspace</p><h2>Selamat datang kembali</h2><p>Masuk untuk melanjutkan ke ruang kerja Anda.</p><form onSubmit={submit}><label><span><UserRound size={16} /> Username</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="username" /></label><label><span><LockKeyhole size={16} /> Password</span><div className="password-field"><input autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>{error && <p className="form-error">{error}</p>}<button className="primary-button login-submit" type="submit">Masuk ke workspace <ArrowRight size={18} /></button></form>{showDemo && <button className="login-demo-link" onClick={onDemo}><Sparkles size={15} /> Lihat demo interaktif</button>}<div className="login-security-note"><LockKeyhole size={15} /><span>Workspace Anda terlindungi dengan sesi aman.</span></div></div>{showPortal && <button className="portal-link" onClick={onOpenPortal}>Lihat contoh client portal <ArrowRight size={16} /></button>}</section>
    </main>
  )
}
