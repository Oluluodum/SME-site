import { useState } from 'react'
import { ArrowLeft, ArrowRight, BadgeCheck, BriefcaseBusiness, Check, Eye, EyeOff, FileCheck2, LockKeyhole, Mail, MapPin, Phone, UserRound } from 'lucide-react'
import { supabase } from './lib/supabase'
import './auth.css'

function AuthPage({ mode, onNavigate }) {
  const isLogin = mode === 'login'
  const [accountType, setAccountType] = useState('personal')
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '', businessName: '', businessType: 'Electronics', registrationNumber: '', registrationAuthority: 'PACRA', location: '', description: '' })
  const [document, setDocument] = useState(null)
  const [status, setStatus] = useState({ type: '', message: '' })
  const [submitting, setSubmitting] = useState(false)

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setStatus({ type: '', message: '' })

    if (!supabase) {
      setStatus({ type: 'error', message: 'Supabase is not configured yet. Add the client environment values to enable accounts.' })
      setSubmitting(false)
      return
    }

    if (!isLogin && accountType === 'business' && !document) {
      setStatus({ type: 'error', message: 'Upload your PACRA certificate, trading licence, or other authority document before continuing.' })
      setSubmitting(false)
      return
    }

    const result = isLogin
      ? await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
      : await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: {
              full_name: form.fullName,
              role: accountType === 'business' ? 'seller' : 'customer',
              phone: accountType === 'business' ? form.phone : null,
              business_name: accountType === 'business' ? form.businessName : null,
              business_type: accountType === 'business' ? form.businessType : null,
              registration_number: accountType === 'business' ? form.registrationNumber : null,
              registration_authority: accountType === 'business' ? form.registrationAuthority : null,
              location: accountType === 'business' ? form.location : null,
              description: accountType === 'business' ? form.description : null,
              documents_pending: accountType === 'business',
            },
          },
        })

    if (result.error) {
      const message = result.error.message.toLowerCase().includes('invalid api key')
        ? 'Supabase rejected the browser key. Replace VITE_SUPABASE_PUBLISHABLE_KEY with the current publishable key from Project Settings > API.'
        : result.error.message
      setStatus({ type: 'error', message })
    }
    else if (!isLogin && accountType === 'business' && result.data.session && document) {
      const extension = document.name.split('.').pop()
      const filePath = `${result.data.user.id}/registration-${Date.now()}.${extension}`
      const upload = await supabase.storage.from('business-docs').upload(filePath, document, { upsert: true, contentType: document.type })
      if (upload.error) setStatus({ type: 'error', message: `Account created, but document upload failed: ${upload.error.message}` })
      else {
        const profileUpdate = await supabase.from('profiles').update({ documents_url: filePath }).eq('id', result.data.user.id)
        if (profileUpdate.error) setStatus({ type: 'error', message: `Account created, but the document record could not be saved: ${profileUpdate.error.message}` })
        else setStatus({ type: 'success', message: 'Business account created and documents submitted for verification.' })
      }
    } else if (isLogin) {
      onNavigate('dashboard')
    } else setStatus({ type: 'success', message: accountType === 'business' ? 'Account created. Confirm your email, then sign in again to submit your document for review.' : 'Account created. Check your email to confirm your account.' })
    setSubmitting(false)
  }

  return (
    <main className="auth-page">
      <div className="auth-art">
        <button className="auth-back" onClick={() => onNavigate('home')}><ArrowLeft size={16} /> Back to marketplace</button>
        <div className="auth-art-copy"><span className="auth-kicker">SME CONNECT</span><h1>Good things<br /><em>start local.</em></h1><p>Discover trusted businesses, find useful products, and build relationships that move communities forward.</p></div>
        <div className="auth-proof"><BadgeCheck size={18} /><span>One account for shopping, selling, and connecting.</span></div>
      </div>
      <section className="auth-panel">
        <div className="auth-panel-head"><span className="auth-mobile-brand">SME <b>Connect</b></span><p className="eyebrow">{isLogin ? 'Welcome back' : 'Join the community'}</p><h2>{isLogin ? 'Sign in to your account' : 'Create your account'}</h2><p>{isLogin ? 'Pick up where you left off.' : 'Choose how you want to use SME Connect.'}</p></div>
        {!isLogin && <div className="account-type-toggle" role="tablist" aria-label="Account type"><button className={accountType === 'personal' ? 'type-option active' : 'type-option'} onClick={() => setAccountType('personal')} role="tab" aria-selected={accountType === 'personal'}><UserRound size={17} /><span><strong>Personal</strong><small>Shop and connect</small></span>{accountType === 'personal' && <Check size={16} />}</button><button className={accountType === 'business' ? 'type-option active' : 'type-option'} onClick={() => setAccountType('business')} role="tab" aria-selected={accountType === 'business'}><BriefcaseBusiness size={17} /><span><strong>Business</strong><small>Sell and grow</small></span>{accountType === 'business' && <Check size={16} />}</button></div>}
        <form className="auth-form" onSubmit={submit}>
          {!isLogin && <label><span>Full name</span><div className="field-wrap"><UserRound size={17} /><input value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} placeholder="Your full name" required /></div></label>}
          {!isLogin && accountType === 'business' && <><label><span>Business name</span><div className="field-wrap"><BriefcaseBusiness size={17} /><input value={form.businessName} onChange={(event) => updateField('businessName', event.target.value)} placeholder="Registered business name" required /></div></label><div className="form-row"><label><span>Registration authority</span><select value={form.registrationAuthority} onChange={(event) => updateField('registrationAuthority', event.target.value)}><option>PACRA</option><option>ZRA</option><option>Local council</option><option>Professional body</option><option>Other authority</option></select></label><label><span>Registration number</span><input value={form.registrationNumber} onChange={(event) => updateField('registrationNumber', event.target.value)} placeholder="e.g. 123456" required /></label></div><div className="form-row"><label><span>Business category</span><select value={form.businessType} onChange={(event) => updateField('businessType', event.target.value)}><option>Electronics</option><option>Fashion</option><option>Services</option><option>Home & Living</option><option>Health & Beauty</option><option>Agriculture</option><option>Other</option></select></label><label><span>Business location</span><div className="field-wrap"><MapPin size={17} /><input value={form.location} onChange={(event) => updateField('location', event.target.value)} placeholder="e.g. Lusaka" required /></div></label></div><label><span>Business phone</span><div className="field-wrap"><Phone size={17} /><input type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="e.g. +260 97 000 0000" required /></div></label><label><span>What does your business do?</span><textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Describe your products or services" required /></label><label className="document-upload"><span>Authority document <b>Required</b></span><div className="upload-box"><FileCheck2 size={20} /><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setDocument(event.target.files?.[0] || null)} required /><small>{document ? document.name : 'Upload PACRA certificate, trading licence, or authority document'}</small></div></label></>}
          <label><span>Email address</span><div className="field-wrap"><Mail size={17} /><input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="you@example.com" required /></div></label>
          <label><span>Password</span><div className="field-wrap"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => updateField('password', event.target.value)} placeholder="At least 6 characters" minLength="6" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
          {isLogin && <button type="button" className="forgot-link">Forgot password?</button>}
          {status.message && <p className={status.type === 'error' ? 'auth-status error' : 'auth-status success'}>{status.message}</p>}
          <button className="auth-submit" disabled={submitting}>{submitting ? 'Please wait...' : isLogin ? 'Sign in' : accountType === 'business' ? 'Create business account' : 'Create personal account'} <ArrowRight size={17} /></button>
        </form>
        <p className="auth-switch">{isLogin ? 'New to SME Connect?' : 'Already have an account?'} <button onClick={() => onNavigate(isLogin ? 'signup' : 'login')}>{isLogin ? 'Create an account' : 'Sign in'}</button></p>
      </section>
    </main>
  )
}

export default AuthPage
