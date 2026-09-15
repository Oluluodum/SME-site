import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, BadgeCheck, BriefcaseBusiness, ChevronDown, Heart, Leaf, MapPin, Menu, MessageCircle, Moon, PackageCheck, Search, ShoppingBag, Sparkles, Store, Sun, X, Zap } from 'lucide-react'
import './App.css'
import './commerce-theme.css'
import './theme.css'
import AuthPage from './AuthPage.jsx'
import BuyerDashboard from './BuyerDashboard.jsx'
import SellerDashboard from './SellerDashboard.jsx'
import { supabase } from './lib/supabase'

const categories = [
  { name: 'All Categories', icon: Sparkles },
  { name: 'Electronics', icon: Zap },
  { name: 'Fashion', icon: Sparkles },
  { name: 'Services', icon: BriefcaseBusiness },
  { name: 'Home & Living', icon: Store },
  { name: 'Health & Beauty', icon: Heart },
  { name: 'Agriculture', icon: Leaf },
]

const configuredApiBase = import.meta.env.VITE_API_URL || ''
const apiBase = import.meta.env.PROD && /localhost|127\.0\.0\.1/.test(configuredApiBase) ? '' : configuredApiBase
const assetUrl = (imageUrl) => imageUrl?.startsWith('/') ? `${apiBase}${imageUrl}` : imageUrl

function AdminDashboard({ user, profile, products, applications = [], stats = {}, onNavigate, onApproveSeller, onRejectSeller, onDownloadDocument, onSignOut }) {
  const [activeTab, setActiveTab] = useState('Dashboard')
  const [adminTheme, setAdminTheme] = useState('dark')
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const tabs = ['Dashboard', 'Users', 'Businesses', 'Products', 'Reports']
  const isBusinessProfile = (entry = {}) => {
    const role = (entry.role || 'customer').toString().toLowerCase()
    return role === 'seller' || role === 'business' || !!entry.business_name || !!entry.business_type || !!entry.documents_url || !!entry.registration_number
  }

  const businessAccounts = Array.isArray(applications)
    ? applications.filter((entry) => isBusinessProfile(entry))
    : []
  const userAccounts = Array.isArray(applications)
    ? applications.filter((entry) => !isBusinessProfile(entry))
    : []
  const pendingApplications = businessAccounts.filter((entry) => !entry.verified && entry.documents_url)

  const filterList = (list, type) => {
    const normalized = searchText.trim().toLowerCase()
    return list.filter((entry) => {
      const matchesSearch = !normalized || JSON.stringify(entry).toLowerCase().includes(normalized)
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'verified' && entry.verified)
        || (statusFilter === 'pending' && !entry.verified)
        || (statusFilter === 'active' && (entry.role === 'seller' || entry.role === 'business' || entry.business_name))

      const isTypeMatch = type === 'user' ? !businessAccounts.some((business) => business.id === entry.id) : businessAccounts.some((business) => business.id === entry.id)
      return matchesSearch && matchesStatus && isTypeMatch
    })
  }

  const userTableRows = filterList(userAccounts, 'user')
  const businessTableRows = filterList(businessAccounts, 'business')

  const adminProducts = (Array.isArray(products) ? products : []).slice(0, 6).map((product, index) => ({
    name: product.name || `Product ${index + 1}`,
    seller: product.business?.businessName || 'Unassigned',
    status: product.status || 'available',
    price: product.price || 'ZMW 0',
  }))

  const reports = [
    { title: 'Seller applications', value: typeof stats.pendingReviews === 'number' ? `${stats.pendingReviews} pending` : 'No live data', trend: 'Needs review' },
    { title: 'Verified businesses', value: typeof stats.activeBusinesses === 'number' ? String(stats.activeBusinesses) : 'No live data', trend: 'Active' },
    { title: 'Live products', value: typeof stats.liveProducts === 'number' ? String(stats.liveProducts) : 'No live data', trend: 'Marketplace' },
    { title: 'Revenue', value: typeof stats.monthlyRevenue === 'string' && stats.monthlyRevenue ? stats.monthlyRevenue : 'No live revenue', trend: 'All-time sales' },
  ]

  const palette = adminTheme === 'light'
    ? { appBg: '#f8fafc', panelBg: '#ffffff', panelSoft: '#f1f5f9', asideBg: '#0f172a', asideText: '#e2e8f0', text: '#0f172a', muted: '#64748b', border: '#e2e8f0', primary: '#1d4ed8', primarySoft: '#dbeafe' }
    : { appBg: '#0f172a', panelBg: '#111827', panelSoft: '#1f2937', asideBg: '#020817', asideText: '#e2e8f0', text: '#f8fafc', muted: '#cbd5e1', border: '#334155', primary: '#60a5fa', primarySoft: '#1d4ed8' }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Users':
        return (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>User directory</h3>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search users..." style={{ minWidth: 200, background: palette.panelSoft, color: palette.text, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '8px 10px' }} />
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ background: palette.panelSoft, color: palette.text, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '8px 10px' }}>
                  <option value="all">All</option>
                  <option value="verified">Active</option>
                  <option value="pending">Standard</option>
                </select>
              </div>
            </div>
            <div style={cardStyle()}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: palette.muted }}>
                    <th style={tableCellStyle()}>Name</th>
                    <th style={tableCellStyle()}>Role</th>
                    <th style={tableCellStyle()}>Email</th>
                    <th style={tableCellStyle()}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {userTableRows.length ? userTableRows.map((entry) => (
                    <tr key={entry.id || entry.email} style={{ borderTop: `1px solid ${palette.border}` }}>
                      <td style={tableCellStyle()}>{entry.full_name || entry.email || 'User account'}</td>
                      <td style={tableCellStyle()}>{(entry.role || 'customer').toString().toLowerCase() === 'admin' ? 'Admin' : 'Customer'}</td>
                      <td style={tableCellStyle()}>{entry.email || 'Not provided'}</td>
                      <td style={tableCellStyle()}><span style={pillStyle(entry.verified ? 'verified' : 'pending')}>{entry.verified ? 'Active' : 'Standard'}</span></td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" style={{ ...tableCellStyle(), padding: '18px 12px', color: palette.muted }}>No customer or admin users were found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      case 'Businesses':
        return (
          <div style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Business directory</h3>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search businesses..." style={{ minWidth: 220, background: palette.panelSoft, color: palette.text, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '8px 10px' }} />
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ background: palette.panelSoft, color: palette.text, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '8px 10px' }}>
                  <option value="all">All</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                </select>
              </div>
            </div>
            <div style={cardStyle()}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {(Array.isArray(businessTableRows) ? businessTableRows : []).map((business) => (
                  <div key={business.id || business.email} style={{ border: `1px solid ${palette.border}`, borderRadius: 14, padding: 16, background: palette.panelSoft }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, color: palette.text }}>{business.business_name || business.full_name || 'Unregistered seller'}</div>
                    <div style={{ color: palette.muted, marginBottom: 4 }}>{business.business_type || 'Business'}</div>
                    <div style={{ color: palette.muted, marginBottom: 4 }}>{business.location || 'Location not set'}</div>
                    <span style={pillStyle(business.verified ? 'verified' : 'pending')}>{business.verified ? 'Verified' : 'Pending review'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      case 'Products':
        return (
          <div style={{ display: 'grid', gap: 16 }}>
            <h3 style={{ margin: 0 }}>Marketplace products</h3>
            <div style={cardStyle()}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b' }}>
                    <th style={tableCellStyle()}>Product</th>
                    <th style={tableCellStyle()}>Seller</th>
                    <th style={tableCellStyle()}>Status</th>
                    <th style={tableCellStyle()}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {adminProducts.map((item) => (
                    <tr key={item.name} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={tableCellStyle()}>{item.name}</td>
                      <td style={tableCellStyle()}>{item.seller}</td>
                      <td style={tableCellStyle()}>{item.status}</td>
                      <td style={tableCellStyle()}>{item.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      case 'Reports':
        return (
          <div style={{ display: 'grid', gap: 16 }}>
            <h3 style={{ margin: 0 }}>Performance reports</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              {reports.map((report) => (
                <div key={report.title} style={cardStyle()}>
                  <div style={{ color: '#64748b', marginBottom: 8 }}>{report.title}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{report.value}</div>
                  <div style={{ color: '#16a34a', fontSize: 13 }}>{report.trend}</div>
                </div>
              ))}
            </div>
          </div>
        )
      default:
        return (
          <div style={{ display: 'grid', gap: 16 }}>
            <h3 style={{ margin: 0 }}>Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div style={cardStyle()}>
                <div style={{ color: '#64748b', marginBottom: 10 }}>Total users</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{typeof stats.totalUsers === 'number' ? stats.totalUsers : '—'}</div>
              </div>
              <div style={cardStyle()}>
                <div style={{ color: '#64748b', marginBottom: 10 }}>Verified businesses</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{typeof stats.activeBusinesses === 'number' ? stats.activeBusinesses : '—'}</div>
              </div>
              <div style={cardStyle()}>
                <div style={{ color: '#64748b', marginBottom: 10 }}>Live products</div>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{typeof stats.liveProducts === 'number' ? stats.liveProducts : '—'}</div>
              </div>
              <div style={cardStyle()}>
                <div style={{ color: '#64748b', marginBottom: 10 }}>Pending reviews</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>{typeof stats.pendingReviews === 'number' ? stats.pendingReviews : '—'}</div>
              </div>
            </div>
            <div style={cardStyle()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0 }}>Recent seller applications</h4>
                <button style={buttonStyle('ghost')} type="button" onClick={() => onNavigate('home')}>Marketplace</button>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#475569', lineHeight: 2 }}>
                {pendingApplications.length ? pendingApplications.slice(0, 4).map((entry) => (
                  <li key={entry.id}>{entry.business_name || entry.full_name || 'Business'} requires review for document verification.</li>
                )) : <li>No seller applications are waiting for review.</li>}
              </ul>
            </div>
          </div>
        )
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: palette.appBg, color: palette.text, fontFamily: 'Inter, Arial, sans-serif' }}>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <aside style={{ width: 260, background: palette.asideBg, color: palette.asideText, padding: '28px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 22 }}>
            <span style={{ width: 36, height: 36, borderRadius: 12, display: 'grid', placeItems: 'center', background: palette.primary }}>S</span>
            SME Admin
          </div>
          <div style={{ color: palette.muted, fontSize: 13 }}>Signed in as {profile?.name || user?.email || 'Admin'}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: palette.muted }}>Theme</span>
            <select value={adminTheme} onChange={(event) => setAdminTheme(event.target.value)} style={{ background: palette.panelSoft, color: palette.text, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '6px 8px' }}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
          <nav style={{ display: 'grid', gap: 8 }}>
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: activeTab === tab ? `1px solid ${palette.primary}` : '1px solid transparent',
                  background: activeTab === tab ? palette.primary : 'transparent',
                  color: '#f8fafc',
                  textAlign: 'left',
                  width: '100%',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {tab}
              </button>
            ))}
          </nav>
          <div style={{ marginTop: 'auto', display: 'grid', gap: 10 }}>
            <button type="button" onClick={() => onNavigate('home')} style={buttonStyle('ghost')}>Back to marketplace</button>
            <button type="button" onClick={onSignOut} style={{ ...buttonStyle('ghost'), background: '#fee2e2', color: '#7f1d1d' }}>Log out</button>
          </div>
        </aside>

        <section style={{ flex: 1, padding: 28, background: palette.appBg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div>
              <div style={{ color: palette.muted, fontSize: 13 }}>Administration</div>
              <h1 style={{ margin: '6px 0 0', fontSize: 36, color: palette.text }}>{activeTab}</h1>
            </div>
            <button style={{ ...buttonStyle('primary'), background: palette.primary }} type="button">Export report</button>
          </div>
          {renderTabContent()}
        </section>
      </div>
    </main>
  )
}

const buttonStyle = (variation) => {
  const base = {
    border: 'none',
    borderRadius: 10,
    padding: '10px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  }

  if (variation === 'primary') return { ...base, background: '#1d4ed8', color: '#fff' }
  if (variation === 'ghost') return { ...base, background: '#e2e8f0', color: '#0f172a' }
  return { ...base, background: '#f1f5f9', color: '#0f172a' }
}

const cardStyle = () => ({
  background: '#fff',
  borderRadius: 18,
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
  border: '1px solid #e2e8f0',
  padding: 18,
})

const pillStyle = (state) => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: state === 'verified' ? '#dcfce7' : '#fff7ed',
  color: state === 'verified' ? '#166534' : '#9a5b00',
})

const tableCellStyle = () => ({ padding: '12px 10px', color: '#0f172a' })

function App() {
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All Categories')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('sme-theme') === 'dark')
  const [view, setView] = useState(() => window.location.hash.slice(1) || 'home')
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [sellerApplications, setSellerApplications] = useState([])
  const [orderRecords, setOrderRecords] = useState([])

  const currentRole = (profile?.role || user?.user_metadata?.role || user?.app_metadata?.role || '').toString().toLowerCase()
  const businessName = profile?.businessName || user?.user_metadata?.business_name || ''

  const isBusinessProfile = (() => {
    const role = currentRole
    return role === 'seller' || role === 'business' || role === 'superadmin' || Boolean(businessName)
  })()

  const isSellerAccount = (() => {
    return currentRole === 'seller' || currentRole === 'business' || currentRole === 'superadmin' || (Boolean(businessName) && currentRole !== 'customer')
  })()

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem('sme-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    const installHandler = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }

    window.addEventListener('beforeinstallprompt', installHandler)
    return () => window.removeEventListener('beforeinstallprompt', installHandler)
  }, [])

  useEffect(() => {
    const handleHashChange = () => setView(window.location.hash.slice(1) || 'home')
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 320)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!supabase) return undefined
    let mounted = true

    const loadSessionProfile = async (session) => {
      const signedInUser = session?.user || null
      if (!mounted) return
      setUser(signedInUser)
      if (!signedInUser) {
        setProfile(null)
        setAuthReady(true)
        return
      }

      const { data } = await supabase.from('profiles').select('full_name, email, location, role, business_name, phone, description, verified, documents_url, business_type, registration_number, registration_authority').eq('id', signedInUser.id).maybeSingle()
      if (!mounted) return
      const resolvedRole = data?.role || signedInUser.user_metadata?.role || 'customer'
      const resolvedBusinessName = data?.business_name || signedInUser.user_metadata?.business_name || ''
      setProfile({
        name: data?.full_name || signedInUser.user_metadata?.full_name || signedInUser.email?.split('@')[0] || 'Buyer',
        email: data?.email || signedInUser.email || '',
        location: data?.location || signedInUser.user_metadata?.location || 'Zambia',
        role: resolvedRole,
        businessName: resolvedBusinessName,
        phone: data?.phone || signedInUser.user_metadata?.phone || '',
        description: data?.description || signedInUser.user_metadata?.description || '',
        verified: !!data?.verified,
        documents_url: data?.documents_url || null,
      })
      setAuthReady(true)
    }

    supabase.auth.getSession().then(({ data: { session } }) => loadSessionProfile(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => loadSessionProfile(session))
    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!supabase) return undefined
    const fetchSellerApplications = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, business_name, business_type, registration_number, registration_authority, location, verified, documents_url, phone, description, created_at')
        .order('created_at', { ascending: false })

      if (!error) setSellerApplications(data || [])
    }

    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, price, status, created_at')
        .order('created_at', { ascending: false })

      if (!error) setOrderRecords(data || [])
    }

    fetchSellerApplications()
    fetchOrders()
  }, [])

  const navigate = (nextView) => {
    window.location.hash = nextView === 'home' ? '' : nextView
    setView(nextView)
  }

  useEffect(() => {
    const search = new URLSearchParams({ q: query, category })
    setLoading(true)
    setError('')
    fetch(`${apiBase}/api/marketplace?${search}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Marketplace request failed (${response.status})`)
        return response.json()
      })
      .then(setProducts)
      .catch((requestError) => setError(`The marketplace could not be loaded. ${requestError.message}`))
      .finally(() => setLoading(false))
  }, [query, category])

  const businesses = useMemo(() => {
    const unique = new Map()
    products.forEach((product) => {
      const business = product.business
      if (business && !unique.has(business.businessName)) unique.set(business.businessName, { ...business, productCount: 1 })
      else if (business) unique.get(business.businessName).productCount += 1
    })
    return [...unique.values()]
  }, [products])

  const cartTotal = cart.reduce((sum, product) => sum + (Number(product.price) || 0), 0)
  const addToCart = (product) => setCart((current) => current.some((item) => item.id === product.id) ? current : [...current, product])
  const removeFromCart = (id) => setCart((current) => current.filter((item) => item.id !== id))
  const handleInstallApp = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setAuthReady(true)
    navigate('home')
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const adminStats = useMemo(() => {
    const businessProfiles = sellerApplications.filter((entry) => {
      const role = (entry.role || 'customer').toString().toLowerCase()
      return role === 'seller' || role === 'business' || !!entry.business_name || !!entry.business_type || !!entry.documents_url || !!entry.registration_number
    })

    const customerProfiles = sellerApplications.filter((entry) => !businessProfiles.some((business) => business.id === entry.id))

    const activeBusinesses = businessProfiles.filter((entry) => entry.verified).length
    const pendingReviews = businessProfiles.filter((entry) => !entry.verified && entry.documents_url).length
    const liveProducts = products.filter((product) => product.status !== 'sold_out').length

    const revenueTotal = orderRecords.reduce((sum, order) => {
      const parsedValue = Number(String(order.price ?? '0').replace(/[^0-9.-]/g, ''))
      return sum + (Number.isFinite(parsedValue) ? parsedValue : 0)
    }, 0)

    return {
      totalUsers: customerProfiles.length,
      activeBusinesses,
      liveProducts,
      pendingReviews,
      monthlyRevenue: `ZMW ${revenueTotal.toLocaleString()}`,
    }
  }, [sellerApplications, orderRecords, products])

  const handleDownloadDocument = async (filePath) => {
    if (!filePath || !supabase) return
    const { data, error } = await supabase.storage.from('business-docs').download(filePath)
    if (error) return console.error(error)
    const url = URL.createObjectURL(data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filePath.split('/').pop() || 'business-document'
    anchor.click()
    URL.revokeObjectURL(url)
  }
  const handleApproveSeller = async (sellerId) => {
    if (!supabase) return
    const { error } = await supabase.from('profiles').update({ verified: true, role: 'seller' }).eq('id', sellerId)
    if (!error) {
      setSellerApplications((current) => current.map((item) => item.id === sellerId ? { ...item, verified: true } : item))
    }
  }
  const handleRejectSeller = async (sellerId) => {
    if (!supabase) return
    const { error } = await supabase.from('profiles').update({ verified: false, documents_url: null }).eq('id', sellerId)
    if (!error) {
      setSellerApplications((current) => current.map((item) => item.id === sellerId ? { ...item, verified: false, documents_url: null } : item))
    }
  }
  const checkout = async () => {
    if (!supabase || !user || !cart.length) return
    const { error: orderError } = await supabase.from('orders').insert(cart.map((product) => ({ buyer_id: user.id, seller_id: product.business?.id || null, product_id: product.id, product_name: product.name, price: String(product.price), status: 'pending' })))
    if (!orderError) setCart([])
  }
  const updateProductStatus = async (productId, nextStatus) => {
    if (!supabase || !user) return { success: false, message: 'Sign in to update inventory.' }
    const { error } = await supabase.from('products').update({ status: nextStatus }).eq('id', productId).eq('seller_id', user.id)
    if (error) return { success: false, message: error.message }
    setProducts((current) => current.map((product) => product.id === productId ? { ...product, status: nextStatus } : product))
    return { success: true, message: nextStatus === 'sold_out' ? 'Product marked as sold out.' : 'Product is available again.' }
  }
  const deleteProduct = async (productId) => {
    if (!supabase || !user) return { success: false, message: 'Sign in to remove products.' }
    const { error } = await supabase.from('products').delete().eq('id', productId).eq('seller_id', user.id)
    if (error) return { success: false, message: error.message }
    setProducts((current) => current.filter((product) => product.id !== productId))
    return { success: true, message: 'Product removed from your listings.' }
  }
  const updateSellerProfile = async (nextProfile) => {
    if (!supabase || !user) return { success: false, message: 'Sign in to update your business details.' }

    const basePayload = {
      full_name: nextProfile.name,
      business_name: nextProfile.businessName,
      location: nextProfile.location,
      email: nextProfile.email,
    }
    const payload = {
      ...basePayload,
      ...(nextProfile.phone ? { phone: nextProfile.phone } : {}),
      ...(nextProfile.description ? { description: nextProfile.description } : {}),
    }

    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id)
    if (error) {
      const isMissingColumnError = /column .*phone|column .*description|Could not find the 'phone' column|Could not find the 'description' column|does not exist/i.test(error.message)
      if (!isMissingColumnError) return { success: false, message: error.message }

      const fallbackPayload = { ...basePayload }
      const fallbackResult = await supabase.from('profiles').update(fallbackPayload).eq('id', user.id)
      if (fallbackResult.error) return { success: false, message: fallbackResult.error.message }

      setProfile((current) => ({ ...current, ...nextProfile, phone: current?.phone || '', description: current?.description || '' }))
      return { success: true, message: 'Business details updated successfully. Optional profile fields were skipped until the database schema is aligned.' }
    }

    setProfile((current) => ({ ...current, ...nextProfile }))
    return { success: true, message: 'Business details updated successfully.' }
  }
  const createProduct = async ({ name, category, price, description, imageFile }) => {
    if (!supabase || !user) return { success: false, message: 'Please sign in to add a product.' }
    if (!name || !category || !price || !description) {
      return { success: false, message: 'Please complete all product details before publishing.' }
    }

    let imageUrl = null
    if (imageFile) {
      const extension = imageFile.name.split('.').pop() || 'png'
      const filePath = `${user.id}/${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, imageFile, { upsert: true, contentType: imageFile.type || 'image/png' })
      if (uploadError) return { success: false, message: `Image upload failed: ${uploadError.message}` }
      imageUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/product-images/${filePath}`
    }

    const payload = {
      seller_id: user.id,
      name,
      category,
      price: String(price),
      description,
      image_url: imageUrl,
      status: 'available',
    }

    const { data, error } = await supabase.from('products').insert(payload).select().single()
    if (error) return { success: false, message: error.message }

    const nextProduct = {
      ...data,
      id: data.id,
      name: data.name,
      category: data.category,
      price: data.price,
      description: data.description,
      imageUrl: data.image_url,
      status: data.status,
      business: {
        id: user.id,
        businessName: profile?.businessName || profile?.name || 'Business',
        verified: true,
        location: profile?.location || 'Zambia',
      },
    }

    setProducts((current) => [nextProduct, ...current])
    return { success: true, message: 'Product published successfully.' }
  }

  if (view === 'login' || view === 'signup') return <AuthPage mode={view} onNavigate={navigate} />
  if (view === 'dashboard') {
    if (!authReady) return <main className="auth-loading">Checking your account...</main>
    if (!user) return <AuthPage mode="login" onNavigate={navigate} />

    const isAdmin = ['admin', 'superadmin'].includes(currentRole)
    const isBusinessAdmin = isAdmin && isBusinessProfile

    if (isAdmin && !isBusinessAdmin) {
      return <AdminDashboard user={user} profile={profile} products={products} applications={sellerApplications} stats={adminStats} onNavigate={navigate} onApproveSeller={handleApproveSeller} onRejectSeller={handleRejectSeller} onDownloadDocument={handleDownloadDocument} onSignOut={handleSignOut} />
    }

    if (isSellerAccount || isBusinessAdmin) {
      return <SellerDashboard products={products} profileData={profile} userId={user.id} onNavigate={navigate} onCreateProduct={createProduct} onUpdateProductStatus={updateProductStatus} onDeleteProduct={deleteProduct} onUpdateProfile={updateSellerProfile} />
    }

    return <BuyerDashboard products={products} cart={cart} profileData={profile} userId={user.id} onAddToCart={addToCart} onRemoveFromCart={removeFromCart} onNavigate={navigate} onCheckout={checkout} />
  }

  return (
    <main className="app-shell">
      <div className="announcement"><span>Supporting local enterprise across Zambia</span><a href="#businesses">Meet the businesses <ArrowRight size={14} /></a></div>
      {installPrompt && (
        <div className="announcement" style={{ background: '#ecfeff', color: '#0f172a' }}>
          <span>Install SME Connect to save it on your home screen.</span>
          <button className="account-link" type="button" onClick={handleInstallApp}>Install app</button>
        </div>
      )}
      <header className="site-header">
        <a className="brand" href="#top" aria-label="SME Connect home"><span className="brand-mark"><Leaf size={20} /></span><span>SME <b>Connect</b></span></a>
        <nav className={menuOpen ? 'main-nav open' : 'main-nav'}><a className="active" href="#shop">Shop</a><a href="#businesses">Businesses</a><a href="#how-it-works">How it works</a><a href="#about">About</a></nav>
        <div className="header-actions"><button className="icon-button menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu"><Menu size={21} /></button><button className="account-link" onClick={() => navigate(user ? 'dashboard' : 'login')}>{user ? 'Dashboard' : 'Sign in'}</button><button className="icon-button theme-button" onClick={() => setDarkMode((current) => !current)} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button><button className="cart-button" onClick={() => setCartOpen(true)} aria-label="Open shopping bag"><ShoppingBag size={19} /><span>{cart.length}</span></button></div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy"><p className="eyebrow"><Sparkles size={14} /> The home of local ambition</p><h1>Find what makes<br /><em>your life better.</em></h1><p className="hero-intro">Shop trusted products and services from ambitious small businesses, makers, and professionals across Zambia.</p><div className="hero-search"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What are you looking for?" /><button onClick={() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' })}>Search</button></div><div className="hero-footnote"><BadgeCheck size={16} /> Every business is reviewed before joining</div></div>
        <div className="hero-visual"><img src="/images/Online%20shopping%20pic.jpg" alt="Online shopping with a laptop, phone, and shopping bags" /><div className="visual-note"><span className="note-icon"><ShoppingBag size={17} /></span><div><strong>Shop local, simply</strong><small>Discover products from businesses near you.</small></div></div><div className="hero-stamp"><span>Est.</span><strong>2026</strong></div></div>
      </section>

      <section className="category-section" aria-label="Shop by category"><div className="section-heading"><div><p className="eyebrow">Browse the marketplace</p><h2>Something for every day.</h2></div><button className="text-button" onClick={() => setCategory('All Categories')}>View all <ArrowRight size={16} /></button></div><div className="category-grid">{categories.slice(1).map(({ name, icon: Icon }) => <button className={category === name ? 'category-card selected' : 'category-card'} key={name} onClick={() => { setCategory(name); document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' }) }}><span><Icon size={22} /></span><strong>{name}</strong><small>Explore now <ArrowRight size={13} /></small></button>)}</div></section>

      <section className="trust-strip"><div><strong>{categories.length - 1}</strong><span>categories to explore</span></div><div><strong>{businesses.length}</strong><span>businesses listed</span></div><div><strong>{products.length}</strong><span>products available</span></div><div className="trust-message"><BadgeCheck size={22} /><span>Shop with confidence from verified sellers.</span></div></section>

      <section className="how-section" id="how-it-works"><div className="how-intro"><p className="eyebrow">Simple by design</p><h2>How SME Connect works.</h2><p>Everything you need to discover local businesses, make confident decisions, and grow your own presence in one place.</p><a className="text-button" href="#shop">Start exploring <ArrowRight size={16} /></a></div><div className="how-steps"><article><span className="step-icon"><Search size={20} /></span><span className="step-number">01</span><h3>Discover</h3><p>Search products and services by category, location, or business name.</p></article><article><span className="step-icon"><BadgeCheck size={20} /></span><span className="step-number">02</span><h3>Choose confidently</h3><p>Browse verified businesses with clear details, pricing, and contact information.</p></article><article><span className="step-icon"><MessageCircle size={20} /></span><span className="step-number">03</span><h3>Connect directly</h3><p>Ask questions, discuss your needs, and build a direct relationship with the seller.</p></article><article><span className="step-icon"><PackageCheck size={20} /></span><span className="step-number">04</span><h3>Trade and grow</h3><p>Place orders, share feedback, and help strong local businesses move forward.</p></article></div></section>

      <section className="shop-section" id="shop"><div className="section-heading shop-heading"><div><p className="eyebrow">Fresh from the community</p><h2>Popular right now.</h2></div><div className="shop-controls"><label><span>Sort by</span><select><option>Recommended</option><option>Newest first</option><option>Price: low to high</option></select><ChevronDown size={14} /></label></div></div><div className="filter-row"><button className={category === 'All Categories' ? 'filter active' : 'filter'} onClick={() => setCategory('All Categories')}>All products <span>{products.length}</span></button>{categories.slice(1).map(({ name }) => <button className={category === name ? 'filter active' : 'filter'} key={name} onClick={() => setCategory(name)}>{name}</button>)}</div>{loading && <p className="message">Loading marketplace...</p>}{error && <p className="message error">{error}</p>}{!loading && !error && !products.length && <p className="message">No products match those filters.</p>}<div className="product-grid">{products.map((product) => <article className="product-card" key={product.id}><div className="product-image-wrap">{product.imageUrl ? <img src={assetUrl(product.imageUrl)} alt={product.name} /> : <div className="product-image-placeholder" aria-hidden="true">{product.name?.slice(0, 1)}</div>}<button className="heart-button" aria-label={`Save ${product.name}`}><Heart size={17} /></button>{product.business?.verified && <span className="verified"><BadgeCheck size={13} /> Verified</span>}</div><div className="product-content"><p className="product-category">{product.category}</p><h3>{product.name}</h3><p className="product-description">{product.description}</p><div className="product-meta"><div><strong>{typeof product.price === 'number' ? `ZMW ${product.price.toLocaleString()}` : product.price}</strong><span>{product.business?.businessName}</span></div><button className="add-button" onClick={() => addToCart(product)} aria-label={`Add ${product.name} to bag`}><ShoppingBag size={17} /></button></div><p className="location"><MapPin size={13} /> {product.business?.location}</p></div></article>)}</div></section>

      <section className="business-section" id="businesses"><div className="business-intro"><p className="eyebrow">The people behind the products</p><h2>Small businesses.<br /><em>Big ideas.</em></h2><p>Meet the independent businesses creating jobs, solving problems, and making life more interesting in our communities.</p><button className="outline-button" type="button" onClick={() => navigate(user ? 'dashboard' : 'signup')}>Explore all businesses <ArrowRight size={16} /></button></div><div className="business-list">{businesses.slice(0, 3).map((business, index) => <article className="business-row" key={business.businessName}><span className="business-number">0{index + 1}</span><div className="business-icon"><Store size={22} /></div><div className="business-info"><h3>{business.businessName} {business.verified && <BadgeCheck size={16} />}</h3><p>{business.description}</p><span><MapPin size={13} /> {business.location}</span></div><ArrowRight className="business-arrow" size={19} /></article>)}</div></section>

      <footer id="about"><div className="footer-brand"><a className="brand" href="#top"><span className="brand-mark"><Leaf size={20} /></span><span>SME <b>Connect</b></span></a><p>A better way to discover, support, and grow local business.</p></div><div className="footer-links"><div><strong>Explore</strong><a href="#shop">Marketplace</a><a href="#businesses">Businesses</a><a href="#how-it-works">How it works</a></div><div><strong>For business</strong><button type="button" className="footer-link-button" onClick={() => navigate('signup')}>Join SME Connect</button><button type="button" className="footer-link-button" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>Seller resources</button><a href="mailto:support@smeconnect.zm?subject=Contact%20SME%20Connect">Contact us</a></div></div><p className="copyright">© 2026 SME Connect. Made for local ambition.</p></footer>

      {showScrollTop && <button type="button" className="scroll-top-button" onClick={scrollToTop} aria-label="Scroll to top"><ArrowRight size={18} /></button>}

      {cartOpen && <div className="drawer-backdrop" onClick={() => setCartOpen(false)}><aside className="cart-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">Your shopping bag</p><h2>{cart.length ? `${cart.length} item${cart.length === 1 ? '' : 's'}` : 'Your bag is empty'}</h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close shopping bag"><X size={21} /></button></div>{cart.length ? <><div className="cart-items">{cart.map((product) => <div className="cart-item" key={product.id}><div className="cart-image-placeholder" aria-hidden="true">{product.name?.slice(0, 1)}</div><div><strong>{product.name}</strong><span>{product.business?.businessName}</span><b>ZMW {Number(product.price).toLocaleString()}</b></div><button onClick={() => removeFromCart(product.id)} aria-label={`Remove ${product.name}`}><X size={15} /></button></div>)}</div><div className="cart-total"><span>Estimated total</span><strong>ZMW {cartTotal.toLocaleString()}</strong></div><button className="checkout-button" onClick={checkout}>Place order <ArrowRight size={17} /></button></> : <div className="empty-bag"><ShoppingBag size={36} /><p>Your bag is waiting for something good.</p><button className="outline-button" onClick={() => setCartOpen(false)}>Continue shopping</button></div>}</aside></div>}
    </main>
  )
}

export default App
