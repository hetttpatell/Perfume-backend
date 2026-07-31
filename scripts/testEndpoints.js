import app from '../src/server.js';
import http from 'http';
import { apiClient } from '../src/config/axios.js';

const PORT = 5004;
const server = http.createServer(app);

server.listen(PORT, async () => {
  console.log(`🧪 Testing Hero & Featured Product Flags on port ${PORT}...`);
  const baseUrl = `http://localhost:${PORT}`;

  try {
    // Test 1: Toggle flags via Admin API
    const toggleRes = await apiClient.post(`${baseUrl}/api/v1/admin/product/toggle-flags`, {
      productId: 'n19-extrait',
      isHero: true,
      isFeatured: true
    });
    console.log('✅ Toggle Hero & Featured Flags:', toggleRes.data.success && toggleRes.data.product.is_hero === true && toggleRes.data.product.is_featured === true ? 'PASSED' : 'FAILED');

    // Test 2: Filter Hero Products
    const heroRes = await apiClient.post(`${baseUrl}/api/v1/products/list`, { isHero: true });
    console.log('✅ Filter Hero Products:', heroRes.data.success && heroRes.data.count > 0 ? `PASSED (${heroRes.data.count} hero items)` : 'FAILED');

    // Test 3: Filter Featured Products
    const featuredRes = await apiClient.post(`${baseUrl}/api/v1/products/list`, { isFeatured: true });
    console.log('✅ Filter Featured Products:', featuredRes.data.success && featuredRes.data.count > 0 ? `PASSED (${featuredRes.data.count} featured items)` : 'FAILED');

    console.log('\n🎉 ALL HERO & FEATURED PRODUCT TOGGLE TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test Failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
