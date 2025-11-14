// ==== CONFIG ==== (edit these!)
const REPO = 'Andrea-Orimoto/sangottardo';
const GITHUB_TOKEN = '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';
const ADMIN_PASSWORD_HASH = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8'; // default "password"
// =================================

const PAGE_SIZE = 12;
let allItems = [], displayed = 0;
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadCSV();
  renderGrid();
  setupFilters();
  renderCartCount();
  document.getElementById('cartBtn').onclick = toggleCart;
  document.getElementById('closeCart').onclick = () => toggleCart(false);
  document.getElementById('saveCartBtn').onclick = saveCartToGitHub;
  document.getElementById('loadMore').onclick = () => renderGrid(true);
  document.getElementById('clearFilters').onclick = () => {
    document.getElementById('search').value = '';
    document.getElementById('catFilter').value = '';
    filterItems();
  };
  // show admin link if already logged in
  if (localStorage.getItem('adminToken')) document.getElementById('adminLink').classList.remove('hidden');
}

async function loadCSV() {
  const resp = await fetch('data/items.csv');
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
    const photos = row.Photos?.trim().split(/\s+/).filter(Boolean);
    if (photos) map.get(uuid).Photos.push(...photos);
  });

  allItems = Array.from(map.values()).filter(i => i.Photos.length);
}

function renderGrid(loadMore = false) {
  if (!loadMore) displayed = 0;
  const container = document.getElementById('grid');
  const fragment = document.createDocumentFragment();
  const filtered = filterItems();

  const start = displayed;
  const end = Math.min(start + PAGE_SIZE, filtered.length);
  for (let i = start; i < end; i++) {
    const item = filtered[i];
    const div = document.createElement('div');
    div.className = 'bg-white rounded overflow-hidden shadow cursor-pointer';
    div.innerHTML = `
      <img src="images/${item.Photos[0]}" alt="${item.Item}" class="w-full h-48 object-cover">
      <div class="p-3">
        <h3 class="font-semibold truncate">${item.Item}</h3>
        <p class="text-sm text-gray-600">${item.Categories || ''}</p>
      </div>`;
    div.onclick = () => openModal(item);
    fragment.appendChild(div);
  }
  container.appendChild(fragment);
  displayed = end;
  document.getElementById('loadMore').classList.toggle('hidden', displayed >= filtered.length);
}

function filterItems() {
  const q = document.getElementById('search').value.toLowerCase();
  const cat = document.getElementById('catFilter').value;
  return allItems.filter(item => {
    const matchSearch = item.Item.toLowerCase().includes(q) || (item.Notes && item.Notes.toLowerCase().includes(q));
    const matchCat = !cat || item.Categories === cat;
    return matchSearch && matchCat;
  });
}

function setupFilters() {
  const cats = [...new Set(allItems.map(i => i.Categories).filter(Boolean))].sort();
  const sel = document.getElementById('catFilter');
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });
  document.getElementById('search').addEventListener('input', () => { displayed = 0; renderGrid(); });
  sel.addEventListener('change', () => { displayed = 0; renderGrid(); });
}

// ---------- MODAL ----------
function openModal(item) {
  document.getElementById('modalTitle').textContent = item.Item;
  document.getElementById('modalDesc').innerHTML = `
    <strong>UUID:</strong> ${item.UUID}<br>
    <strong>Location:</strong> ${item.Location}<br>
    <strong>Categories:</strong> ${item.Categories}<br>
    ${item.Notes ? `<strong>Notes:</strong> ${item.Notes}<br>` : ''}
  `;

  const carousel = document.getElementById('carousel');
  carousel.innerHTML = '';
  item.Photos.forEach(src => {
    const img = document.createElement('img');
    img.src = `images/${src}`;
    img.alt = item.Item;
    img.className = 'inline-block';
    carousel.appendChild(img);
  });

  const addBtn = document.getElementById('addToCartBtn');
  addBtn.onclick = () => addToCart(item.UUID);
  addBtn.textContent = cart.includes(item.UUID) ? 'Added' : 'Add to Cart';
  addBtn.disabled = cart.includes(item.UUID);

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
    alert('Added to cart');
  }
}
function renderCartCount() {
  document.getElementById('cartCount').textContent = cart.length;
}
function toggleCart(show = null) {
  const sidebar = document.getElementById('cartSidebar');
  const open = sidebar.classList.contains('translate-x-0');
  if (show === null) show = !open;
  sidebar.classList.toggle('translate-x-0', show);
  sidebar.classList.toggle('translate-x-full', !show);
  if (show) renderCartItems();
}
function renderCartItems() {
  const container = document.getElementById('cartItems');
  if (cart.length === 0) {
    container.innerHTML = '<p class="text-gray-500">Cart is empty</p>';
    return;
  }
  container.innerHTML = '';
  cart.forEach(uuid => {
    const item = allItems.find(i => i.UUID === uuid);
    if (!item) return;
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 mb-2 border-b pb-2';
    div.innerHTML = `
      <img src="images/${item.Photos[0]}" class="w-12 h-12 object-cover rounded">
      <div class="flex-1">
        <p class="font-medium text-sm">${item.Item}</p>
        <p class="text-xs text-gray-600">${item.Categories}</p>
      </div>
      <button class="text-red-600 text-sm" onclick="removeFromCart('${uuid}')">Remove</button>`;
    container.appendChild(div);
  });
}
window.removeFromCart = function(uuid) {
  cart = cart.filter(id => id !== uuid);
  localStorage.setItem('cart', JSON.stringify(cart));
  renderCartCount();
  renderCartItems();
};

// ---------- SAVE CART TO GITHUB ----------
async function saveCartToGitHub() {
  if (cart.length === 0) return alert('Cart empty');
  const payload = {
    items: cart.map(uuid => {
      const it = allItems.find(i => i.UUID === uuid);
      return { uuid, name: it.Item, thumbnail: it.Photos[0] };
    }),
    savedAt: new Date().toISOString()
  };
  const filename = `carts/cart-${Date.now()}-${Math.random().toString(36).substr(2,5)}.json`;
  const content = btoa(JSON.stringify(payload, null, 2));

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${filename}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Add cart ${new Date().toLocaleString()}`,
        content
      })
    });
    if (!res.ok) throw await res.text();
    document.getElementById('saveMsg').textContent = 'Cart saved!';
    setTimeout(() => document.getElementById('saveMsg').textContent = '', 3000);
  } catch (e) {
    console.error(e);
    alert('Failed to save cart – check token/permissions');
  }
}