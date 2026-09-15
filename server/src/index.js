import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const app = express();
const port = Number(process.env.PORT || 3000);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use('/images', express.static(path.join(projectRoot, 'images')));

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'sme-connect-server',
    supabaseConfigured: Boolean(supabase)
  });
});

app.get('/api/marketplace', async (request, response) => {
  const query = String(request.query.q || '').trim().toLowerCase();
  const category = String(request.query.category || '').trim();

  if (!supabase) {
    return response.status(503).json({ error: 'Marketplace database is not configured.' });
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, price, description, image_url, status, profiles!inner(id, business_name, business_type, location, verified, description)')
    .eq('status', 'available')
    .order('created_at', { ascending: false });

  if (error) return response.status(502).json({ error: 'Marketplace products could not be loaded.' });

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
      description: product.profiles?.description
    }
  }));
  response.json(filterMarketplace(products, query, category));
});

function filterMarketplace(products, query, category) {
  return products.filter((product) => {
    const matchesCategory = !category || category === 'All Categories' || product.category === category;
    const searchableText = `${product.name} ${product.description} ${product.business?.businessName} ${product.business?.location}`.toLowerCase();
    return matchesCategory && (!query || searchableText.includes(query));
  });
}

app.listen(port, () => {
  console.log(`SME Connect API listening on http://localhost:${port}`);
});
