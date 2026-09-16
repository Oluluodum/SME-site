import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BadgeCheck, Bell, ChevronRight, Heart, Leaf, LogOut, MapPin, MessageCircle, Package, Search, Settings, ShoppingBag, UserRound, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './buyer-dashboard.css'

const navItems = [
  { id: 'overview', label: 'Dashboard', icon: Leaf },
  { id: 'browse', label: 'Browse products', icon: Search },
  { id: 'orders', label: 'Cart / Orders', icon: ShoppingBag },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'profile', label: 'Profile', icon: UserRound },
]

const formatPrice = (price) => typeof price === 'number' ? `ZMW ${price.toLocaleString()}` : price

function BuyerDashboard({ products, cart, profileData, userId, onAddToCart, onRemoveFromCart, onNavigate, onCheckout }) {
  const [activeSection, setActiveSection] = useState('overview')
  const [query, setQuery] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [savedProducts, setSavedProducts] = useState([])
  const [profile, setProfile] = useState(profileData)
  const [orders, setOrders] = useState([])
  const [messages, setMessages] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [messageTarget, setMessageTarget] = useState(null)

  const filteredProducts = useMemo(() => products.filter((product) => `${product.name} ${product.category} ${product.business?.businessName || ''}`.toLowerCase().includes(query.toLowerCase())), [products, query])
  const cartTotal = cart.reduce((sum, product) => sum + (Number(product.price) || 0), 0)
  const unreadMessages = messages.filter((message) => message.receiver_id === userId && !message.is_read)
  const toggleSaved = (id) => setSavedProducts((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const selectSection = (section) => { setSelectedProduct(null); setActiveSection(section) }
  const startConversation = (product) => {
    if (!product.business?.id) return
    setMessageTarget({ participantId: product.business.id, participantName: product.business.businessName || 'Business', productName: product.name })
    setSelectedProduct(null)
    setActiveSection('messages')
  }
  const sendMessage = async ({ receiverId, productName, content }) => {
    if (!supabase || !userId || !receiverId || !content.trim()) return { success: false, message: 'Sign in to send a message.' }
    const { data, error } = await supabase.from('messages').insert({ sender_id: userId, receiver_id: receiverId, product_name: productName || 'Product enquiry', content: content.trim(), is_read: false }).select('id, sender_id, receiver_id, product_name, content, is_read, created_at').single()
    if (error) return { success: false, message: error.message }
    setMessages((current) => [{ ...data, participantName: messageTarget?.participantName || 'Business' }, ...current])
    setMessageTarget(null)
    return { success: true }
  }
  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
    onNavigate('login')
  }

  useEffect(() => {
    if (!supabase || !userId) return undefined
    let mounted = true
    Promise.all([
      supabase.from('orders').select('id, product_name, price, status, created_at, seller_id, product_id').eq('buyer_id', userId).order('created_at', { ascending: false }),
      supabase.from('messages').select('id, sender_id, receiver_id, product_name, content, is_read, created_at').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).order('created_at', { ascending: false }),
    ]).then(async ([ordersResult, messagesResult]) => {
      if (!mounted) return
      setOrders(ordersResult.data || [])
      const rawMessages = messagesResult.data || []
      const participantIds = [...new Set(rawMessages.flatMap((message) => [message.sender_id, message.receiver_id]).filter((id) => id && id !== userId))]
      const profilesResult = participantIds.length ? await supabase.from('profiles').select('id, full_name, business_name').in('id', participantIds) : { data: [] }
      const names = new Map((profilesResult.data || []).map((item) => [item.id, item.business_name || item.full_name || 'User']))
      setMessages(rawMessages.map((message) => ({ ...message, participantName: names.get(message.sender_id === userId ? message.receiver_id : message.sender_id) || 'Conversation' })))
      setDataLoading(false)
    })
    return () => { mounted = false }
  }, [userId])

  useEffect(() => {
    if (activeSection !== 'messages' || !supabase || !userId) return undefined
    const unreadIds = messages
      .filter((message) => message.receiver_id === userId && !message.is_read)
      .map((message) => message.id)

    if (!unreadIds.length) return undefined

    setMessages((current) => current.map((message) => unreadIds.includes(message.id) ? { ...message, is_read: true } : message))
    supabase.from('messages').update({ is_read: true }).in('id', unreadIds).eq('receiver_id', userId).then(() => {})
    return undefined
  }, [activeSection, messages, userId])

  useEffect(() => {
    if (!supabase || !userId) return undefined
    const channel = supabase.channel(`buyer-messages-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        const record = payload.new || payload.old
        if (!record || (record.sender_id !== userId && record.receiver_id !== userId)) return
        setMessages((current) => {
          if (payload.eventType === 'DELETE') return current.filter((message) => message.id !== record.id)
          const existing = current.find((message) => message.id === record.id)
          const participantId = record.sender_id === userId ? record.receiver_id : record.sender_id
          const nextMessage = { ...record, participantName: existing?.participantName || messageTarget?.participantName || 'Conversation' }
          return [nextMessage, ...current.filter((message) => message.id !== record.id)]
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, messageTarget])

  if (!profile) return <main className="auth-loading">Loading your profile...</main>

  return (
    <main className="buyer-dashboard">
      <aside className="buyer-sidebar">
        <a className="buyer-brand" href="#dashboard"><span className="buyer-brand-mark"><Leaf size={18} /></span><span>SME <b>Connect</b></span></a>
        <div className="buyer-profile-mini"><span className="avatar">{initials(profile.name)}</span><div><strong>{profile.name}</strong><small>Personal account</small></div><button aria-label="Account settings" onClick={() => selectSection('profile')}><Settings size={16} /></button></div>
        <nav className="buyer-nav" aria-label="Buyer dashboard navigation">{navItems.map(({ id, label, icon: Icon }) => <button className={activeSection === id ? 'buyer-nav-item active' : 'buyer-nav-item'} key={id} onClick={() => selectSection(id)}><Icon size={18} /><span>{label}</span>{id === 'messages' && unreadMessages.length > 0 && <b>{unreadMessages.length}</b>}</button>)}</nav>
        <div className="buyer-sidebar-bottom"><button className="buyer-nav-item" onClick={() => onNavigate('home')}><ArrowLeft size={18} /><span>Back to marketplace</span></button><button className="buyer-nav-item muted" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button></div>
      </aside>

      <section className="buyer-main">
        <header className="buyer-topbar"><div><p className="buyer-kicker">Personal space</p><h1>{activeSection === 'overview' ? `Welcome, ${profile.name}.` : navItems.find((item) => item.id === activeSection)?.label}</h1></div><div className="buyer-top-actions"><button className="buyer-icon-button" aria-label="Notifications"><Bell size={19} />{unreadMessages.length > 0 && <span>{unreadMessages.length}</span>}</button><button className="buyer-cart-link" onClick={() => selectSection('orders')}><ShoppingBag size={18} /><span>{cart.length} items</span></button><button className="dashboard-signout" type="button" onClick={signOut}><LogOut size={16} /><span>Sign out</span></button><span className="buyer-avatar avatar">{initials(profile.name)}</span></div></header>

        {activeSection === 'overview' && <Overview products={products} cart={cart} orders={orders} dataLoading={dataLoading} onSelect={setSelectedProduct} onSection={selectSection} />}
        {activeSection === 'browse' && <Browse products={filteredProducts} query={query} setQuery={setQuery} savedProducts={savedProducts} onToggleSaved={toggleSaved} onSelect={setSelectedProduct} onAddToCart={onAddToCart} />}
        {activeSection === 'orders' && <Orders cart={cart} cartTotal={cartTotal} orders={orders} dataLoading={dataLoading} onRemove={onRemoveFromCart} onBrowse={() => selectSection('browse')} onCheckout={onCheckout} />}
        {activeSection === 'messages' && <Messages messages={messages} dataLoading={dataLoading} userId={userId} messageTarget={messageTarget} onSendMessage={sendMessage} />}
        {activeSection === 'profile' && <Profile profile={profile} setProfile={setProfile} />}
      </section>

      {selectedProduct && <ProductDetails product={selectedProduct} saved={savedProducts.includes(selectedProduct.id)} onToggleSaved={toggleSaved} onAddToCart={onAddToCart} onMessage={startConversation} onClose={() => setSelectedProduct(null)} />}
    </main>
  )
}

const initials = (name) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()

function Overview({ products, cart, orders, dataLoading, onSelect, onSection }) {
  const latestOrder = orders[0]
  return <div className="buyer-content"><div className="buyer-welcome"><div><span className="buyer-kicker">Your buyer workspace</span><h2>Your local finds, all in one place.</h2><p>Keep exploring trusted businesses and pick up where you left off.</p><button className="buyer-primary" onClick={() => onSection('browse')}>Explore products <ArrowRight size={16} /></button></div><div className="welcome-art"><Leaf size={78} /></div></div><div className="buyer-stats"><div><span>Open orders</span><strong>{dataLoading ? '...' : orders.filter((order) => !['delivered', 'cancelled'].includes(String(order.status).toLowerCase())).length}</strong><small>From your account</small></div><div><span>Saved items</span><strong>0</strong><small>Save products as you browse</small></div><div><span>Cart total</span><strong>{formatPrice(cart.reduce((sum, product) => sum + (Number(product.price) || 0), 0))}</strong><small>{cart.length} items ready</small></div></div><div className="buyer-section-heading"><div><p className="buyer-kicker">Picked for you</p><h2>Popular in the community</h2></div><button className="buyer-text-button" onClick={() => onSection('browse')}>View all <ChevronRight size={16} /></button></div><div className="buyer-product-row">{products.slice(0, 3).map((product) => <MiniProduct key={product.id} product={product} onSelect={onSelect} />)}</div>{latestOrder && <><div className="buyer-section-heading recent-heading"><div><p className="buyer-kicker">Recent activity</p><h2>Latest order</h2></div><button className="buyer-text-button" onClick={() => onSection('orders')}>View orders <ChevronRight size={16} /></button></div><div className="recent-order"><span className="order-icon"><Package size={20} /></span><div><strong>Order #{latestOrder.id.slice(0, 8).toUpperCase()}</strong><p>{latestOrder.product_name || 'Product order'}</p></div><span className="order-status">{latestOrder.status}</span><ChevronRight size={18} /></div></>}</div>
}

function MiniProduct({ product, onSelect }) {
  return <button className="mini-product" onClick={() => onSelect(product)}>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="product-image-placeholder" aria-hidden="true">{product.name?.slice(0, 1)}</span>}<span><small>{product.category}</small><strong>{product.name}</strong><b>{formatPrice(product.price)}</b></span><ArrowRight size={16} /></button>
}

function Browse({ products, query, setQuery, savedProducts, onToggleSaved, onSelect, onAddToCart }) {
  return <div className="buyer-content"><div className="browse-toolbar"><div><p className="buyer-kicker">The marketplace</p><h2>Find something useful.</h2></div><label className="buyer-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or businesses" /></label></div><div className="browse-meta"><span>{products.length} products available</span><select><option>Recommended</option><option>Price: low to high</option><option>Newest first</option></select></div><div className="buyer-product-grid">{products.map((product) => <article className="buyer-product-card" key={product.id}><button className="buyer-product-image" onClick={() => onSelect(product)}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <span className="product-image-placeholder" aria-hidden="true">{product.name?.slice(0, 1)}</span>}{product.business?.verified && <span><BadgeCheck size={13} /> Verified</span>}</button><div className="buyer-product-copy"><div className="product-line"><small>{product.category}</small><button className={savedProducts.includes(product.id) ? 'saved' : ''} onClick={() => onToggleSaved(product.id)} aria-label={`Save ${product.name}`}><Heart size={17} fill={savedProducts.includes(product.id) ? 'currentColor' : 'none'} /></button></div><button className="product-name" onClick={() => onSelect(product)}>{product.name}</button><p>{product.description}</p><div className="buyer-product-footer"><div><strong>{formatPrice(product.price)}</strong><small>{product.business?.businessName}</small></div><button className="add-to-cart" onClick={() => onAddToCart(product)} aria-label={`Add ${product.name} to cart`}><ShoppingBag size={16} /></button></div><small className="product-location"><MapPin size={12} /> {product.business?.location}</small></div></article>)}</div></div>
}

function Orders({ cart, cartTotal, orders, dataLoading, onRemove, onBrowse, onCheckout }) {
  return <div className="buyer-content"><div className="buyer-section-heading"><div><p className="buyer-kicker">Your purchases</p><h2>Cart and orders</h2></div><button className="buyer-primary compact" onClick={onBrowse}><Search size={16} /> Continue shopping</button></div><div className="order-tabs"><button className="active">Cart <b>{cart.length}</b></button><button>Active orders <b>{dataLoading ? '...' : orders.filter((order) => !['delivered', 'cancelled'].includes(String(order.status).toLowerCase())).length}</b></button><button>Past orders <b>{dataLoading ? '...' : orders.filter((order) => ['delivered', 'cancelled'].includes(String(order.status).toLowerCase())).length}</b></button></div><div className="cart-panel">{cart.length ? <>{cart.map((product) => <div className="dashboard-cart-item" key={product.id}>{product.imageUrl ? <img src={product.imageUrl} alt="" /> : <span className="product-image-placeholder" aria-hidden="true">{product.name?.slice(0, 1)}</span>}<div><small>{product.business?.businessName}</small><strong>{product.name}</strong><b>{formatPrice(product.price)}</b></div><button onClick={() => onRemove(product.id)} aria-label={`Remove ${product.name}`}><X size={16} /></button></div>)}<div className="cart-panel-total"><span>Estimated total</span><strong>{formatPrice(cartTotal)}</strong></div><button className="buyer-primary checkout" onClick={onCheckout}>Place order <ArrowRight size={16} /></button></> : <div className="dashboard-empty"><ShoppingBag size={32} /><h3>Your cart is ready for something good.</h3><p>Browse local products and add your first item.</p><button className="buyer-primary" onClick={onBrowse}>Browse products <ArrowRight size={16} /></button></div>}</div><h2 className="subheading">Order history</h2>{orders.length ? <div className="order-history">{orders.map((order) => <div key={order.id}><span className="order-icon"><Package size={18} /></span><p><strong>#{order.id.slice(0, 8).toUpperCase()}</strong><small>{order.product_name || 'Product order'} · {new Date(order.created_at).toLocaleDateString()}</small></p><b className={String(order.status).toLowerCase() === 'delivered' ? 'delivered' : ''}>{order.status}</b><ChevronRight size={17} /></div>)}</div> : <div className="dashboard-empty"><Package size={32} /><h3>No orders yet.</h3><p>Your completed purchases will appear here.</p></div>}</div>
}

function Messages({ messages, dataLoading, userId, messageTarget, onSendMessage }) {
  const latest = messages[0]
  const conversation = latest || messageTarget
  const [chatOpen, setChatOpen] = useState(Boolean(messageTarget))
  const latestIsUnread = conversation?.receiver_id === userId && !conversation?.is_read
  const participantId = conversation ? (conversation.sender_id === userId ? conversation.receiver_id : conversation.receiver_id || conversation.participantId) : null
  const conversationMessages = participantId ? messages.filter((message) => message.sender_id === participantId || message.receiver_id === participantId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) : []
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const handleSend = async (event) => {
    event.preventDefault()
    if (!conversation || !draft.trim()) return
    setSending(true)
    const result = await onSendMessage({ receiverId: conversation.sender_id === userId ? conversation.receiver_id : conversation.receiver_id || conversation.participantId, productName: conversation.product_name || conversation.productName, content: draft })
    setSending(false)
    if (result?.success) setDraft('')
    else window.alert(result?.message || 'Unable to send message.')
  }
  return <div className="buyer-content"><div className="buyer-section-heading"><div><p className="buyer-kicker">Stay connected</p><h2>Messages</h2></div></div>{dataLoading ? <div className="dashboard-empty"><MessageCircle size={32} /><h3>Loading your messages...</h3></div> : conversation ? <div className={chatOpen ? 'message-layout buyer-message-layout chat-is-open' : 'message-layout buyer-message-layout'}><div className="conversation-list"><button type="button" className="conversation active" onClick={() => setChatOpen(true)}><span className="conversation-avatar">{initials(conversation.participantName)}</span><span><strong>{conversation.participantName}</strong><small>{conversation.content || `Start a conversation about ${conversation.productName || 'this business'}`}</small></span>{latestIsUnread && <b>1</b>}</button></div>{chatOpen && <div className="chat-panel"><div className="chat-head"><span className="conversation-avatar">{initials(conversation.participantName)}</span><div><strong>{conversation.participantName}</strong><small>Conversation</small></div><button type="button" className="message-close-button" onClick={() => setChatOpen(false)} aria-label="Close chat"><X size={16} /></button></div><div className="chat-body"><div className={conversation.sender_id === userId ? 'chat-bubble sent' : 'chat-bubble received'}>{conversation.content || `Start a conversation about ${conversation.productName || 'this business'}`}</div>{conversation.sender_id === userId && <div className="message-delivery-status">{conversation.is_read ? 'Seen' : 'Delivered'}</div>}<div className="chat-time">{conversation.created_at ? new Date(conversation.created_at).toLocaleString() : 'New conversation'}</div><form className="customer-message-form" onSubmit={handleSend}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message..." aria-label="Write a message" /><button className="buyer-primary compact" type="submit" disabled={sending || !draft.trim()}>{sending ? 'Sending...' : 'Send'}</button></form></div></div>}</div> : <div className="dashboard-empty"><MessageCircle size={32} /><h3>No messages yet.</h3><p>Open a product and message the business to start a conversation.</p></div>}</div>
}

function Profile({ profile, setProfile }) {
  const saveProfile = async (event) => { event.preventDefault(); if (supabase) await supabase.from('profiles').update({ full_name: profile.name, location: profile.location }).eq('email', profile.email) }
  return <div className="buyer-content"><div className="buyer-section-heading"><div><p className="buyer-kicker">Your account</p><h2>Profile and preferences</h2></div><button className="buyer-primary compact"><Settings size={16} /> Preferences</button></div><div className="profile-layout"><div className="profile-summary"><span className="profile-avatar">{initials(profile.name)}</span><h3>{profile.name}</h3><p>{profile.email}</p><span className="verified-profile"><BadgeCheck size={14} /> Verified account</span></div><form className="profile-form" onSubmit={saveProfile}><label><span>Full name</span><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label><span>Email address</span><input type="email" value={profile.email} readOnly /></label><label><span>Delivery location</span><div className="profile-input"><MapPin size={16} /><input value={profile.location} onChange={(event) => setProfile({ ...profile, location: event.target.value })} /></div></label><button className="buyer-primary" type="submit">Save changes <ArrowRight size={16} /></button></form></div></div>
}

function ProductDetails({ product, saved, onToggleSaved, onAddToCart, onMessage, onClose }) {
  return <div className="product-detail-backdrop" onClick={onClose}><article className="product-detail" onClick={(event) => event.stopPropagation()}><button className="detail-close" onClick={onClose} aria-label="Close product details"><X size={19} /></button>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <div className="detail-image-placeholder" aria-hidden="true">{product.name?.slice(0, 1)}</div>}<div className="detail-copy"><small>{product.category}</small><h2>{product.name}</h2><div className="detail-business"><span className="conversation-avatar">{product.business?.businessName?.slice(0, 2).toUpperCase()}</span><div><strong>{product.business?.businessName}</strong>{product.business?.verified && <span><BadgeCheck size={13} /> Verified local business</span>}</div></div><p>{product.description}</p><span className="detail-location"><MapPin size={14} /> {product.business?.location}</span><strong className="detail-price">{formatPrice(product.price)}</strong><div className="detail-actions"><button className="buyer-primary" onClick={() => onAddToCart(product)}>Add to cart <ShoppingBag size={16} /></button><button className={saved ? 'detail-save saved' : 'detail-save'} onClick={() => onToggleSaved(product.id)}><Heart size={17} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save item'}</button></div><button className="detail-message" onClick={() => onMessage(product)}><MessageCircle size={16} /> Message this business</button></div></article></div>
}

export default BuyerDashboard
