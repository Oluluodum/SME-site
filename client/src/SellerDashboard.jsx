import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  ChevronRight,
  DollarSign,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Store,
  UserRound,
  X,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import './buyer-dashboard.css'

const navItems = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'My Products', icon: Store },
  { id: 'add-product', label: 'Add Product', icon: Plus },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'customers', label: 'Customers', icon: UserRound },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'profile', label: 'Business Profile', icon: Settings },
]

function SellerDashboard({ products, profileData, userId, onNavigate, onCreateProduct, onUpdateProductStatus, onDeleteProduct, onUpdateProfile }) {
  const [activeSection, setActiveSection] = useState('overview')
  const [query, setQuery] = useState('')

  const businessProducts = useMemo(
    () => products.filter((product) => product.business?.id === userId || product.seller_id === userId || product.business?.businessName === profileData?.businessName),
    [products, userId, profileData],
  )

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
    onNavigate('login')
  }

  return (
    <main className="buyer-dashboard">
      <aside className="buyer-sidebar">
        <a className="buyer-brand" href="#dashboard"><span className="buyer-brand-mark"><BriefcaseBusiness size={18} /></span><span>SME <b>Connect</b></span></a>
        <div className="buyer-profile-mini">
          <span className="avatar">{initials(profileData?.businessName || profileData?.name || 'Business')}</span>
          <div>
            <strong>{profileData?.businessName || profileData?.name || 'Business account'}</strong>
            <small>Seller workspace</small>
          </div>
          <button aria-label="Business settings" onClick={() => setActiveSection('profile')}><Settings size={16} /></button>
        </div>

        <nav className="buyer-nav" aria-label="Business dashboard navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              className={activeSection === id ? 'buyer-nav-item active' : 'buyer-nav-item'}
              key={id}
              onClick={() => setActiveSection(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="buyer-sidebar-bottom">
          <button className="buyer-nav-item" onClick={() => onNavigate('home')}><ArrowLeft size={18} /><span>Back to marketplace</span></button>
          <button className="buyer-nav-item muted" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button>
        </div>
      </aside>

      <section className="buyer-main">
        <header className="buyer-topbar">
          <div>
            <p className="buyer-kicker">Business space</p>
            <h1>{activeSection === 'overview' ? `Welcome, ${profileData?.businessName || profileData?.name}.` : navItems.find((item) => item.id === activeSection)?.label}</h1>
          </div>
          <div className="buyer-top-actions">
            <button className="buyer-icon-button" aria-label="Notifications"><Bell size={19} /></button>
            <button className="buyer-cart-link" onClick={() => setActiveSection('orders')}><ShoppingBag size={18} /><span>{businessProducts.length} items</span></button>
            <span className="buyer-avatar avatar">{initials(profileData?.businessName || profileData?.name || 'Business')}</span>
          </div>
        </header>

        {activeSection === 'overview' && <SellerOverview products={businessProducts} businessName={profileData?.businessName || profileData?.name} onSection={setActiveSection} />}
        {activeSection === 'products' && <SellerProducts products={businessProducts} query={query} setQuery={setQuery} onUpdateProductStatus={onUpdateProductStatus} onDeleteProduct={onDeleteProduct} />}
        {activeSection === 'add-product' && <AddProduct onCreateProduct={onCreateProduct} onDone={() => setActiveSection('products')} />}
        {activeSection === 'orders' && <SellerOrders products={businessProducts} />}
        {activeSection === 'customers' && <SellerCustomers />}
        {activeSection === 'messages' && <SellerMessages userId={userId} />}
        {activeSection === 'profile' && <SellerProfile profile={profileData} onUpdateProfile={onUpdateProfile} />}
      </section>
    </main>
  )
}

function SellerOverview({ products, businessName, onSection }) {
  const revenue = products.reduce((sum, product) => sum + (Number(product.price) || 0), 0)

  return (
    <div className="buyer-content">
      <div className="buyer-welcome">
        <div>
          <span className="buyer-kicker">Your seller workspace</span>
          <h2>Manage your business from one place.</h2>
          <p>Track products, respond to orders, and keep your storefront growing.</p>
          <button className="buyer-primary" onClick={() => onSection('add-product')}>Add product <ArrowRight size={16} /></button>
        </div>
        <div className="welcome-art"><BriefcaseBusiness size={78} /></div>
      </div>

      <div className="buyer-stats">
        <div>
          <span>Listed products</span>
          <strong>{products.length}</strong>
          <small>{businessName || 'Your store'}</small>
        </div>
        <div>
          <span>Monthly sales</span>
          <strong>ZMW {revenue.toLocaleString()}</strong>
          <small>Estimated value</small>
        </div>
        <div>
          <span>Orders</span>
          <strong>{products.length > 0 ? '12' : '0'}</strong>
          <small>Pending + fulfilled</small>
        </div>
      </div>

      <div className="buyer-section-heading">
        <div>
          <p className="buyer-kicker">Your storefront</p>
          <h2>Products on sale</h2>
        </div>
        <button className="buyer-text-button" onClick={() => onSection('products')}>View all <ChevronRight size={16} /></button>
      </div>

      <div className="buyer-product-row">
        {products.length ? (
          products.slice(0, 3).map((product) => (
            <button className="mini-product" key={product.id} onClick={() => onSection('products')}>
              <span className="product-image-placeholder" aria-hidden="true">{product.name?.slice(0, 1)}</span>
              <span>
                <small>{product.category}</small>
                <strong>{product.name}</strong>
                <b>ZMW {Number(product.price || 0).toLocaleString()}</b>
              </span>
              <ArrowRight size={16} />
            </button>
          ))
        ) : (
          <div className="dashboard-empty">
            <Store size={32} />
            <h3>No products yet.</h3>
            <p>Add your first item to start selling.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function SellerProducts({ products, query, setQuery, onUpdateProductStatus, onDeleteProduct }) {
  const filteredProducts = useMemo(
    () => products.filter((product) => `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase())),
    [products, query],
  )

  const handleStatusToggle = async (productId, currentStatus) => {
    const nextStatus = currentStatus === 'sold_out' ? 'available' : 'sold_out'
    const result = await onUpdateProductStatus(productId, nextStatus)
    if (result?.success) {
      window.alert(result.message)
    } else {
      window.alert(result?.message || 'Unable to update product status.')
    }
  }

  const handleDelete = async (productId) => {
    const confirmed = window.confirm('Remove this listing from your store?')
    if (!confirmed) return
    const result = await onDeleteProduct(productId)
    if (result?.success) {
      window.alert(result.message)
    } else {
      window.alert(result?.message || 'Unable to remove this product.')
    }
  }

  return (
    <div className="buyer-content">
      <div className="browse-toolbar">
        <div>
          <p className="buyer-kicker">Inventory</p>
          <h2>My products</h2>
        </div>
        <label className="buyer-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your products" />
        </label>
      </div>

      <div className="buyer-product-grid">
        {filteredProducts.length ? (
          filteredProducts.map((product) => (
            <article className="buyer-product-card" key={product.id}>
              <div className="buyer-product-image">
                <span className="product-image-placeholder" aria-hidden="true">{product.name?.slice(0, 1)}</span>
                {product.business?.verified && <span><BadgeCheck size={13} /> Verified</span>}
              </div>
              <div className="buyer-product-copy">
                <div className="product-line"><small>{product.category}</small></div>
                <button className="product-name">{product.name}</button>
                <p>{product.description}</p>
                <div className="buyer-product-footer">
                  <div>
                    <strong>ZMW {Number(product.price || 0).toLocaleString()}</strong>
                    <small>{product.status === 'sold_out' ? 'Sold out' : 'Available'}</small>
                  </div>
                  <button className="add-to-cart" aria-label={`Edit ${product.name}`}><Settings size={16} /></button>
                </div>
                <div className="detail-actions" style={{ marginTop: 12 }}>
                  <button className="buyer-primary compact" type="button" onClick={() => handleStatusToggle(product.id, product.status)}>{product.status === 'sold_out' ? 'Mark available' : 'Mark sold out'}</button>
                  <button className="detail-save" type="button" onClick={() => handleDelete(product.id)}>Remove</button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="dashboard-empty full-width">
            <Package size={32} />
            <h3>No products match your search.</h3>
            <p>Use the add product view to list your first item.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function AddProduct({ onCreateProduct, onDone }) {
  const [form, setForm] = useState({ name: '', category: 'Electronics', price: '', description: '' })
  const [status, setStatus] = useState({ type: '', message: '' })
  const [submitting, setSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setStatus({ type: '', message: '' })

    const result = await onCreateProduct({
      name: form.name,
      category: form.category,
      price: form.price,
      description: form.description,
      imageFile,
    })

    if (result?.success) {
      setStatus({ type: 'success', message: result.message })
      setForm({ name: '', category: 'Electronics', price: '', description: '' })
      setImageFile(null)
      setTimeout(() => onDone?.(), 600)
    } else {
      setStatus({ type: 'error', message: result?.message || 'Something went wrong.' })
    }

    setSubmitting(false)
  }

  return (
    <div className="buyer-content">
      <div className="buyer-section-heading">
        <div>
          <p className="buyer-kicker">Create listing</p>
          <h2>Add product</h2>
        </div>
      </div>

      <div className="profile-layout">
        <form className="profile-form" onSubmit={submit}>
          <label><span>Product name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Solar lantern" required /></label>
          <div className="form-row">
            <label><span>Category</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Electronics</option><option>Fashion</option><option>Services</option><option>Home & Living</option><option>Health & Beauty</option><option>Agriculture</option></select></label>
            <label><span>Price (ZMW)</span><input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="500" required /></label>
          </div>
          <label><span>Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe the product, materials, and benefits" required /></label>
          <label><span>Product image</span><input type="file" accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] || null)} /></label>
          {status.message && <p className={status.type === 'error' ? 'auth-status error' : 'auth-status success'}>{status.message}</p>}
          <button className="buyer-primary" type="submit" disabled={submitting}>{submitting ? 'Publishing...' : 'Publish product'} <ArrowRight size={16} /></button>
        </form>
      </div>
    </div>
  )
}

function SellerOrders({ products }) {
  return (
    <div className="buyer-content">
      <div className="buyer-section-heading">
        <div>
          <p className="buyer-kicker">Sales</p>
          <h2>Orders</h2>
        </div>
      </div>

      <div className="order-tabs">
        <button className="active">Open <b>{products.length}</b></button>
        <button>Fulfilled <b>0</b></button>
        <button>Cancelled <b>0</b></button>
      </div>

      <div className="cart-panel">
        {products.length ? (
          products.map((product) => (
            <div className="dashboard-cart-item" key={product.id}>
              <span className="product-image-placeholder" aria-hidden="true">{product.name?.slice(0, 1)}</span>
              <div>
                <small>{product.category}</small>
                <strong>{product.name}</strong>
                <b>ZMW {Number(product.price || 0).toLocaleString()}</b>
              </div>
              <button aria-label={`Manage ${product.name}`}><ChevronRight size={16} /></button>
            </div>
          ))
        ) : (
          <div className="dashboard-empty">
            <ShoppingBag size={32} />
            <h3>No orders yet.</h3>
            <p>Your incoming orders will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function SellerCustomers() {
  return (
    <div className="buyer-content">
      <div className="buyer-section-heading">
        <div>
          <p className="buyer-kicker">Relationships</p>
          <h2>Customers</h2>
        </div>
      </div>
      <div className="profile-layout">
        <div className="dashboard-empty">
          <UserRound size={32} />
          <h3>Customer list coming soon.</h3>
          <p>Track repeat buyers and their order history here.</p>
        </div>
      </div>
    </div>
  )
}

function SellerMessages({ userId }) {
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedParticipantId, setSelectedParticipantId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [chatOpen, setChatOpen] = useState(true)
  const [attachment, setAttachment] = useState(null)

  const buildThreads = async (data) => {
    const participantIds = [...new Set((data || []).flatMap((message) => [message.sender_id, message.receiver_id]).filter((id) => id && id !== userId))]
    const profilesResult = participantIds.length ? await supabase.from('profiles').select('id, full_name, business_name').in('id', participantIds) : { data: [] }
    const names = new Map((profilesResult.data || []).map((profile) => [profile.id, profile.business_name || profile.full_name || 'Customer']))

    const grouped = new Map()
    ;(data || []).forEach((message) => {
      const otherId = message.sender_id === userId ? message.receiver_id : message.sender_id
      if (!otherId) return
      if (!grouped.has(otherId)) {
        grouped.set(otherId, {
          participantId: otherId,
          participantName: names.get(otherId) || 'Customer',
          messages: [],
        })
      }
      grouped.get(otherId).messages.push({
        ...message,
        isMine: message.sender_id === userId,
      })
    })

    return [...grouped.values()].map((thread) => ({
      ...thread,
      messages: thread.messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
      unreadCount: thread.messages.filter((message) => !message.is_read && message.receiver_id === userId).length,
    })).sort((a, b) => new Date(b.messages.at(-1)?.created_at || 0) - new Date(a.messages.at(-1)?.created_at || 0))
  }

  const refreshThreads = async () => {
    if (!supabase || !userId) return
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, product_name, content, image_url, is_read, created_at')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (error) return
    const nextThreads = await buildThreads(data || [])
    setThreads(nextThreads)
    if (!selectedParticipantId && nextThreads[0]) setSelectedParticipantId(nextThreads[0].participantId)
  }

  useEffect(() => {
    if (!supabase || !userId) return undefined
    let mounted = true

    const loadMessages = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, product_name, content, image_url, is_read, created_at')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false })

      if (!mounted) return
      if (error) {
        setThreads([])
        setLoading(false)
        return
      }

      const nextThreads = await buildThreads(data || [])
      if (mounted) {
        setThreads(nextThreads)
        setSelectedParticipantId((current) => current || nextThreads[0]?.participantId || null)
        setChatOpen(Boolean(nextThreads[0]))
      }
      if (mounted) setLoading(false)
    }

    loadMessages()
    return () => { mounted = false }
  }, [userId])

  const activeThread = threads.find((thread) => thread.participantId === selectedParticipantId) || threads[0]

  useEffect(() => {
    if (!supabase || !userId || !activeThread) return undefined
    const markAsRead = async () => {
      if (!activeThread.messages.some((message) => message.receiver_id === userId && !message.is_read)) return
      await supabase.from('messages').update({ is_read: true }).eq('receiver_id', userId).eq('sender_id', activeThread.participantId)
      setThreads((current) => current.map((thread) => thread.participantId === activeThread.participantId ? {
        ...thread,
        unreadCount: 0,
        messages: thread.messages.map((message) => (message.receiver_id === userId ? { ...message, is_read: true } : message)),
      } : thread))
    }
    markAsRead()
    return undefined
  }, [activeThread, userId])

  const sendReply = async (event) => {
    event.preventDefault()
    if ((!replyText.trim() && !attachment) || !activeThread || !supabase) return

    setSending(true)

    let attachmentUrl = null
    if (attachment) {
      const extension = attachment.name.split('.').pop() || 'file'
      const filePath = `${userId}/${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('chat-images').upload(filePath, attachment, { upsert: true, contentType: attachment.type || 'application/octet-stream' })
      if (uploadError) {
        setSending(false)
        window.alert(`Attachment failed: ${uploadError.message}`)
        return
      }
      attachmentUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/chat-images/${filePath}`
    }

    const { error } = await supabase.from('messages').insert({
      sender_id: userId,
      receiver_id: activeThread.participantId,
      product_name: activeThread.messages.at(-1)?.product_name || 'Product enquiry',
      content: replyText.trim() || 'Attachment',
      image_url: attachmentUrl,
      is_read: false,
    })

    setSending(false)
    setReplyText('')
    setAttachment(null)

    if (error) {
      window.alert(error.message)
      return
    }
    await refreshThreads()
  }

  if (loading) {
    return <div className="buyer-content"><div className="dashboard-empty"><MessageCircle size={32} /><h3>Loading messages...</h3></div></div>
  }

  if (!threads.length) {
    return <div className="buyer-content"><div className="buyer-section-heading"><div><p className="buyer-kicker">Inbox</p><h2>Messages</h2></div></div><div className="profile-layout"><div className="dashboard-empty"><MessageCircle size={32} /><h3>No business messages yet.</h3><p>Customer conversations will appear here.</p></div></div></div>
  }

  return (
    <div className="buyer-content">
      <div className="buyer-section-heading">
        <div>
          <p className="buyer-kicker">Inbox</p>
          <h2>Messages</h2>
        </div>
      </div>

      <div className="message-layout" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        <div className="conversation-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {threads.map((thread) => (
            <button
              key={thread.participantId}
              type="button"
              className={thread.participantId === activeThread?.participantId ? 'conversation active' : 'conversation'}
              onClick={() => {
                setSelectedParticipantId(thread.participantId)
                setChatOpen(true)
              }}
              style={{ width: '100%', textAlign: 'left', borderRadius: 12, padding: 12, background: thread.participantId === activeThread?.participantId ? '#dfeafc' : '#fff', border: '1px solid #dfe3ee', display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}
            >
              <span className="conversation-avatar">{initials(thread.participantName)}</span>
              <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block' }}>{thread.participantName}</strong><small style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.messages.at(-1)?.content || 'New message'}</small></span>
              {thread.unreadCount > 0 && <b>{thread.unreadCount}</b>}
            </button>
          ))}
        </div>

        {chatOpen && activeThread ? (
          <div className="chat-panel" style={{ background: '#fff', border: '1px solid #dfe3ee', borderRadius: 16, padding: 16 }}>
            <div className="chat-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="conversation-avatar">{initials(activeThread.participantName)}</span>
                <div>
                  <strong>{activeThread.participantName}</strong>
                  <small>Customer enquiry</small>
                </div>
              </div>
              <button type="button" className="icon-button" onClick={() => setChatOpen(false)} aria-label="Close chat" style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #dfe3ee', background: '#fff' }}><X size={16} /></button>
            </div>

            <div className="chat-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 260, maxHeight: 420, overflowY: 'auto', paddingRight: 6 }}>
              {activeThread.messages.map((message) => (
                <div key={message.id} style={{ maxWidth: '75%', alignSelf: message.isMine ? 'flex-end' : 'flex-start' }}>
                  <div className={message.isMine ? 'chat-bubble sent' : 'chat-bubble received'} style={{ background: message.isMine ? '#1d7a5d' : '#eef2f7', color: message.isMine ? '#fff' : '#1f2a37', padding: '10px 12px', borderRadius: message.isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px', marginBottom: 6 }}>
                    {message.image_url && <img src={message.image_url} alt="Shared attachment" style={{ display: 'block', maxWidth: 220, borderRadius: 10, marginBottom: 8 }} />}
                    {message.content && <div>{message.content}</div>}
                  </div>
                  {message.isMine && <div style={{ fontSize: 11, color: '#5f6c7b', textAlign: 'right', marginBottom: 4 }}>{message.is_read ? 'Seen' : 'Delivered'}</div>}
                  {!message.isMine && <div style={{ fontSize: 11, color: '#5f6c7b', textAlign: 'left', marginBottom: 4 }}>{new Date(message.created_at).toLocaleString()}</div>}
                </div>
              ))}
            </div>

            <form onSubmit={sendReply} style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #dfe3ee', borderRadius: 10, padding: '10px 12px', background: '#f7f8fb' }}>
                <input value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="Reply to customer" style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none' }} />
                <input type="file" onChange={(event) => setAttachment(event.target.files?.[0] || null)} style={{ display: 'none' }} id={`attachment-${activeThread.participantId}`} />
                <label htmlFor={`attachment-${activeThread.participantId}`} style={{ cursor: 'pointer', color: '#1d7a5d', fontWeight: 700 }}>Attach</label>
              </label>
              {attachment && <span style={{ width: '100%', fontSize: 12, color: '#475569' }}>Attachment: {attachment.name}</span>}
              <button className="buyer-primary compact" type="submit" disabled={sending || (!replyText.trim() && !attachment)}>{sending ? 'Sending...' : 'Send'}</button>
            </form>
          </div>
        ) : (
          <div className="dashboard-empty" style={{ minHeight: 280 }}>
            <MessageCircle size={32} />
            <h3>Select a conversation</h3>
            <p>Open a message thread to reply to a customer.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function SellerProfile({ profile, onUpdateProfile }) {
  const [form, setForm] = useState({
    name: profile?.name || '',
    businessName: profile?.businessName || '',
    email: profile?.email || '',
    location: profile?.location || '',
    phone: profile?.phone || '',
    description: profile?.description || '',
  })
  const [status, setStatus] = useState({ type: '', message: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm({
      name: profile?.name || '',
      businessName: profile?.businessName || '',
      email: profile?.email || '',
      location: profile?.location || '',
      phone: profile?.phone || '',
      description: profile?.description || '',
    })
  }, [profile])

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setStatus({ type: '', message: '' })

    const result = await onUpdateProfile({
      ...form,
      name: form.name,
      businessName: form.businessName,
      email: form.email,
      location: form.location,
      phone: form.phone,
      description: form.description,
    })

    if (result?.success) {
      setStatus({ type: 'success', message: result.message })
    } else {
      setStatus({ type: 'error', message: result?.message || 'Unable to save business details.' })
    }
    setSaving(false)
  }

  return (
    <div className="buyer-content">
      <div className="buyer-section-heading">
        <div>
          <p className="buyer-kicker">Brand details</p>
          <h2>Business profile</h2>
        </div>
      </div>

      <div className="profile-layout">
        <div className="profile-summary">
          <span className="profile-avatar">{initials(form.businessName || form.name || 'Business')}</span>
          <h3>{form.businessName || form.name || 'Business account'}</h3>
          <p>{form.email || 'seller@example.com'}</p>
          <span className="verified-profile"><BadgeCheck size={14} /> Verified business</span>
        </div>

        <form className="profile-form" onSubmit={submit}>
          <label><span>Account holder name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label><span>Business name</span><input value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} /></label>
          <label><span>Email address</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label><span>Phone</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <label><span>Location</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
          <label><span>Business description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          {status.message && <p className={status.type === 'error' ? 'auth-status error' : 'auth-status success'}>{status.message}</p>}
          <button className="buyer-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save changes'} <ArrowRight size={16} /></button>
        </form>
      </div>
    </div>
  )
}

const initials = (name) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

export default SellerDashboard
