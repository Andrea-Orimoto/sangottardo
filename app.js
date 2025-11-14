// ==== CONFIG ==== (edit these!)
const REPO = 'Andrea-Orimoto/sangottardo';
const GITHUB_TOKEN = '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';
const ADMIN_PASSWORD_HASH = '6972cf16a98ceb52957e425cdf7dc642eca2e97cc1aef848f530509894362d32'; // default "password"
// =================================

const PAGE_SIZE = 12;
let allItems = [], displayed = 0;
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

document.addEventListener('DOMContentLoaded', init);

async function init() {
  console.log('Initializing app...'); // Debug
  await loadCSV();
  console.log(`Loaded ${allItems.length} items`); // Debug
  renderGrid();
  setupFilters();
  renderCartCount();
  document.getElementById('cartBtn').onclick = toggleCart;
  document.getElementById('closeCart').onclick = () => toggleCart(false);
  document.getElementById('saveCartBtn').onclick = saveCartToGitHub;
  document.getElementById('loadMore').onclick = () => renderGrid(true);
  document.getElementById('clearFilters').onclick = clearFilters;
  
  // Show admin link if logged in
  if (localStorage.getItem('adminToken')) document.getElementById('adminLink').classList.remove('hidden');
}

async function loadCSV() {
  try {
    const resp = await fetch('data/items.csv');
    if (!resp.ok) throw new Error('CSV fetch failed');
    const text = await resp.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

    // Merge rows with same UUID
    const map = new Map();
    parsed.data.forEach(row => {
      const uuid = row.UUID;
      if (!uuid) return;
      if (!map.has(uuid)) {
        map.set(uuid, { ...row, Photos: [] });
      }
      const photos = (row.Photos || '').trim().split(/\s+/).filter(Boolean);
      if (photos.length) map.get(uuid).Photos.push(...photos);
    });

    allItems = Array.from(map.values()).filter(i => i.Photos && i.Photos.length > 0);
    console.log('CSV parsed successfully'); // Debug
  } catch (e) {
    console.error('CSV load error:', e); // Will show in console
    allItems = []; // Fallback
  }
}

function renderGrid(loadMore = false) {
  if (!loadMore) {
    document.getElementById('grid').innerHTML = ''; // Clear for fresh render
    displayed = 0;
  }
  
  const container = document.getElementById('grid');
  const fragment = document.createDocumentFragment();
  const filtered = filterItems();
  console.log(`Rendering ${filtered.length} filtered items`); // Debug

  const start = displayed;
  const end = Math.min(start + PAGE_SIZE, filtered.length);
  for (let i = start; i < end; i++) {
    const item = filtered[i];
    const div = document.createElement('div');
    div.className = 'bg-white rounded overflow-hidden shadow cursor-pointer hover:shadow-lg transition-shadow';
    div.innerHTML = `
      <img src="images/${item.Photos[0]}" alt="${item.Item}" class="w-full h-48 object-cover" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
      <div class="p-3">
        <h3 class="font-semibold truncate">${item.Item}</h3>
        <p class="text-sm text-gray-600">${item.Categories || 'Uncategorized'}</p>
      </div>`;
    div.onclick = () => openModal(item);
    fragment.appendChild(div);
  }
  container.appendChild(fragment);
  displayed = end;
  document.getElementById('loadMore').classList.toggle('hidden', displayed >= filtered.length);
  
  if (loadMore && end === start) console.log('No more items to load'); // Debug
}

function filterItems() {
  const q = (document.getElementById('search').value || '').toLowerCase().trim();
  const cat = document.getElementById('catFilter').value;
  
  return allItems.filter(item => {
    const searchText = (item.Item + ' ' + (item.Categories || '') + ' ' + (item.Notes || '')).toLowerCase();
    const matchSearch = !q || searchText.includes(q);
    const matchCat = !cat || item.Categories === cat;
    return matchSearch && matchCat;
  });
}

function setupFilters() {
  const sel = document.getElementById('catFilter');
  sel.innerHTML = '<option value="">All Categories</option>'; // Reset
  
  const cats = [...new Set(allItems.map(i => i.Categories).filter(Boolean))].sort();
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    sel.appendChild(opt);
  });
  
  // Debounced search (wait 300ms after typing)
  let timeout;
  document.getElementById('search').addEventListener('input', (e) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      console.log(`Search: "${e.target.value}"`); // Debug
      displayed = 0;
      renderGrid();
    }, 300);
  });
  
  document.getElementById('catFilter').addEventListener('change', () => {
    console.log(`Category filter: ${document.getElementById('catFilter').value}`); // Debug
    displayed = 0;
    renderGrid();
  });
}

function clearFilters() {
  document.getElementById('search').value = '';
  document.getElementById('catFilter').value = '';
  displayed = 0;
  renderGrid();
}

// ---------- MODAL ----------
function openModal(item) {
  document.getElementById('modalTitle').textContent = item.Item;
  document.getElementById('modalDesc').innerHTML = `
    <strong>UUID:</strong> ${item.UUID}<br>
    <strong>Location:</strong> ${item.Location || 'N/A'}<br>
    <strong>Categories:</strong> ${item.Categories || 'N/A'}<br>
    ${item.Notes ? `<strong>Notes:</strong> ${item.Notes}<br>` : ''}
    ${item['Purchase Date'] ? `<strong>Purchased:</strong> ${item['Purchase Date']}<br>` : ''}
  `;

  const carousel = document.getElementById('carousel');
  carousel.innerHTML = '';
  item.Photos.forEach((src, idx) => {
    const img = document.createElement('img');
    img.src = `images/${src}`;
    img.alt = `${item.Item} - Photo ${idx + 1}`;
    img.className = 'inline-block snap-start px-2';
    img.style.minWidth = '100%';
    img.style.height = 'auto';
    img.onerror = () => { img.src = 'https://via.placeholder.com/400x300?text=No+Image'; };
    carousel.appendChild(img);
  });

  const addBtn = document.getElementById('addToCartBtn');
  const inCart = cart.includes(item.UUID);
  addBtn.textContent = inCart ? 'Added ✓' : 'Add to Cart';
  addBtn.disabled = inCart;
  addBtn.onclick = () => addToCart(item.UUID);

  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('closeModal').onclick = () => document.getElementById('modal').classList.add('hidden');
}

// ---------- CART ----------
function addToCart(uuid) {
  if (!cart.includes(uuid)) {
    cart.push(uuid);
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCartCount();
    renderCartItems();
    alert(`Added "${allItems.find(i => i.UUID === uuid)?.Item}" to cart!`);
  }
}

function renderCartCount() {
  document.getElementById('cartCount').textContent = cart.length;
}

function toggleCart(show = null) {
  const sidebar = document.getElementById('cartSidebar');
  const isOpen = !sidebar.classList.contains('translate-x-full');
  if (show === null) show = !isOpen;
  sidebar.classList.toggle('translate-x-0', show);
  sidebar.classList.toggle('translate-x-full', !show);
  if (show) renderCartItems();
}

function renderCartItems() {
  const container = document.getElementById('cartItems');
  if (cart.length === 0) {
    container.innerHTML = '<p class="text-gray-500 italic">Your cart is empty. Start browsing!</p>';
    return;
  }
  container.innerHTML = cart.map(uuid => {
    const item = allItems.find(i => i.UUID === uuid);
    if (!item) return '';
    return `
      <div class="flex items-center gap-3 mb-3 p-2 border rounded">
        <img src="images/${item.Photos[0]}" class="w-16 h-16 object-cover rounded" onerror="this.src='https://via.placeholder.com/64?text=?';">
        <div class="flex-1">
          <p class="font-medium text-sm">${item.Item}</p>
          <p class="text-xs text-gray-600">${item.Categories || ''}</p>
        </div>
        <button class="text-red-600 hover:text-red-800 text-sm" onclick="removeFromCart('${uuid}')">Remove</button>
      </div>
    `;
  }).join('');
}

window.removeFromCart = function(uuid) {
  cart = cart.filter(id => id !== uuid);
  localStorage.setItem('cart', JSON.stringify(cart));
  renderCartCount();
  renderCartItems();
};

// ---------- SAVE CART TO GITHUB ----------
async function saveCartToGitHub() {
  if (cart.length === 0) return alert('Cart is empty—add some items first!');
  
  const payload = {
    items: cart.map(uuid => {
      const it = allItems.find(i => i.UUID === uuid);
      return { 
        uuid, 
        name: it?.Item || 'Unknown', 
        category: it?.Categories || '',
        thumbnail: it?.Photos[0] || '',
        timestamp: new Date().toISOString()
      };
    }),
    totalItems: cart.length,
    savedAt: new Date().toISOString()
  };
  
  const filename = `carts/cart-${Date.now()}-${Math.random().toString(36).substr(2,5)}.json`;
  const content = btoa(JSON.stringify(payload, null, 2));
  const msgEl = document.getElementById('saveMsg');

  try {
    console.log('Saving cart to GitHub...'); // Debug
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${filename}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `New cart saved: ${cart.length} items (${new Date().toLocaleString()})`,
        content
      })
    });
    
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GitHub API: ${res.status} - ${err}`);
    }
    
    msgEl.textContent = `✅ Cart saved! (${filename})`;
    msgEl.className = 'mt-2 text-sm text-green-600';
    setTimeout(() => { msgEl.textContent = ''; msgEl.className = 'mt-2 text-sm'; }, 5000);
    console.log('Cart saved successfully'); // Debug
  } catch (e) {
    console.error('Save error:', e); // Debug
    msgEl.textContent = `❌ Failed: ${e.message}`;
    msgEl.className = 'mt-2 text-sm text-red-600';
    alert(`Save failed—check console for details. Common fix: Token expired?`);
  }
}