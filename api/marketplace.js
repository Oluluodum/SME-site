const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || process.env.VITE_SUPABASE_ANON_KEY

export default async function handler(request, response) {
  const query = String(request.query?.q || '').trim().toLowerCase()
  const category = String(request.query?.category || '').trim()

  if (!supabaseUrl || !supabaseKey) {
    return response.status(503).json({ error: 'Marketplace database is not configured.' })
  }

  const select = 'id,name,category,price,description,image_url,status,profiles!inner(id,business_name,business_type,location,verified,description)'
  const productsUrl = new URL(`${supabaseUrl}/rest/v1/products`)
  productsUrl.searchParams.set('select', select)
  productsUrl.searchParams.set('status', 'eq.available')
  productsUrl.searchParams.set('order', 'created_at.desc')
  const productsResponse = await fetch(productsUrl, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  })

  if (!productsResponse.ok) return response.status(502).json({ error: 'Marketplace products could not be loaded.' })
  const data = await productsResponse.json()

  const products = (data || []).map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    description: product.description,
    status: product.status,
    imageUrl: product.image_url,
    business: {
      id: product.profiles?.id,
      businessName: product.profiles?.business_name,
      businessType: product.profiles?.business_type,
      location: product.profiles?.location,
      verified: product.profiles?.verified,
      description: product.profiles?.description,
    },
  }))

  return response.json(products.filter((product) => {
    const matchesCategory = !category || category === 'All Categories' || product.category === category
    const searchableText = `${product.name} ${product.description} ${product.business?.businessName} ${product.business?.location}`.toLowerCase()
    return matchesCategory && (!query || searchableText.includes(query))
  }))
}