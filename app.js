// ==== CONFIG ==== (edit these!)
const REPO = 'Andrea-Orimoto/sangottardo';
const GITHUB_TOKEN = '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';
const ADMIN_PASSWORD_HASH = '6972cf16a98ceb52957e425cdf7dc642eca2e97cc1aef848f530509894362d32'; // default "password"
// =================================

const PAGE_SIZE = 12;
let allItems = [], displayed = 0;
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let currentSlide = 0;

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
  document.getElementById('clearFilters').onclick = clearFilters;
  if (localStorage.getItem('adminToken')) document.getElementById('adminLink').classList.remove('hidden');
}

async function loadCSV() {
  try {
    const resp = await fetch('data/items.csv');
    if (!resp.ok) throw new Error('CSV fetch failed');
    const text = await resp.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
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
  } catch (e) {
    console.error('CSV load error:', e);
    allItems = [];
  }
}

function renderGrid(loadMore = false) {
  if (!loadMore) {
    document.getElementById('grid').innerHTML = '';
    displayed = 0;
  }
  const container = document.getElementById('grid');
  const fragment = document.createDocumentFragment();
  const filtered = filterItems();
  const start = displayed;
  const end = Math.min(start + PAGE_SIZE, filtered.length);
  for (let i = start; i < end; i++) {
    const item = filtered[i];
    const div = document.createElement('div');
    div.className = 'bg-white rounded overflow-hidden shadow cursor-pointer hover:shadow-lg transition-shadow';
    div.innerHTML = `
      <div class="bg-gray-100 p-4 flex items-center justify-center rounded-t-lg">
        <img src="images/${item.Photos[0]}" 
             alt="${item.Item}" 
             class="max-w-full max-h-48 w-auto h-auto object-contain transition-transform hover:scale-105"
             onerror="this.src='images/placeholder.jpg'">
      </div>
      <div class="p-3 flex-1">
        <h3 class="font-semibold truncate">${item.Item}</h3>
        <p class="text-sm text-gray-600">Category: ${item.Location || '—'}</p>
        <p class="text-xs text-gray-500 mt-1">Serial: ${item['Serial No'] || '—'}</p>
        <p class="text-sm font-medium text-indigo-600 mt-2">Price: ${formatPrice(item)}</p>
      </div>`;
    div.onclick = () => openModal(item);
    fragment.appendChild(div);
  }
  container.appendChild(fragment);
  displayed = end;
  document.getElementById('loadMore').classList.toggle('hidden', displayed >= filtered.length);
}

function formatPrice(item) {
  const price = item['Purchase Price'];
  const currency = item['Purchase Currency'] || 'EUR';
  if (!price) return '—';
  return `${price} ${currency}`;
}

function filterItems() {
  const q = (document.getElementById('search').value || '').toLowerCase().trim();
  const locFilter = document.getElementById('catFilter').value;
  return allItems.filter(item => {
    const searchText = (item.Item + ' ' + (item.Location || '') + ' ' + (item.Categories || '') + ' ' + (item.Notes || '')).toLowerCase();
    const matchSearch = !q || searchText.includes(q);
    const matchLocation = !locFilter || (item.Location || '').trim() === locFilter;
    return matchSearch && matchLocation;
  });
}

function setupFilters() {
  const sel = document.getElementById('catFilter');
  sel.innerHTML = '<option value="">All Categories</option>';
  const locations = [...new Set(allItems.map(i => i.Location).filter(Boolean))].sort();
  locations.forEach(loc => {
    const opt = document.createElement('option');
    opt.value = loc;
    opt.textContent = loc;
    sel.appendChild(opt);
  });
  let timeout;
  document.getElementById('search').addEventListener('input', (e) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => { displayed = 0; renderGrid(); }, 300);
  });
  document.getElementById('catFilter').addEventListener('change', () => { displayed = 0; renderGrid(); });
}

function clearFilters() {
  document.getElementById('search').value = '';
  document.getElementById('catFilter').value = '';
  displayed = 0;
  renderGrid();
}

// === MODAL ===
function openModal(item) {
  document.getElementById('modalTitle').textContent = item.Item;
  document.getElementById('modalDesc').innerHTML = `
    <strong>Serial Number:</strong> ${item['Serial No'] || '—'}<br>
    <strong>Category:</strong> ${item.Location || '—'}<br>
    <strong>Scatola:</strong> ${item.Categories || '—'}<br>
    ${item.Notes ? `<strong>Notes:</strong><br><span class="text-sm italic text-gray-700">${item.Notes.replace(/\n/g, '<br>')}</span><br>` : ''}
    ${item['Purchase Date'] ? `<strong>Purchased:</strong> ${item['Purchase Date']}<br>` : ''}
    <strong>Price:</strong> ${formatPrice(item)}
  `;

  const track = document.getElementById('carouselTrack');
  const dotsContainer = document.getElementById('carouselDots');
  track.innerHTML = '';
  dotsContainer.innerHTML = '';

  item.Photos.forEach((src, idx) => {
    const slide = document.createElement('div');
    slide.className = 'min-w-full flex items-center justify-center bg-gray-100';
    const img = document.createElement('img');
    img.src = `images/${src}`;
    img.alt = `${item.Item} - ${idx + 1}`;
    img.className = 'max-w-full max-h-full object-contain';
    img.onerror = () => { img.src = 'images/placeholder.jpg'; };
    slide.appendChild(img);
    track.appendChild(slide);

    const dot = document.createElement('div');
    dot.className = 'carousel-dot';
    dot.dataset.index = idx;
    dot.onclick = () => goToSlide(idx);
    dotsContainer.appendChild(dot);
  });

  currentSlide = 0;
  updateCarousel();

  const addBtn = document.getElementById('addToCartBtn');
  const inCart = cart.includes(item.UUID);
  addBtn.textContent = inCart ? 'Added' : 'Add to Cart';
  addBtn.disabled = inCart;
  addBtn.onclick = () => addToCart(item.UUID);

  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('closeModal').onclick = closeModal;
  setupCarouselControls(item.Photos.length);
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function goToSlide(index) {
  const total = document.getElementById('carouselTrack').children.length;
  if (index < 0) index = total - 1;
  if (index >= total) index = 0;
  currentSlide = index;
  updateCarousel();
}

function updateCarousel() {
  const track = document.getElementById('carouselTrack');
  track.style.transform = `translateX(-${currentSlide * 100}%)`;
  updateDots();
}

function updateDots() {
  const dots = document.querySelectorAll('#carouselDots .carousel-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === currentSlide);
  });
}

function setupCarouselControls(totalSlides) {
  const track = document.getElementById('carouselTrack');
  let startX = 0;
  let isDown = false;

  track.addEventListener('touchstart', e => {
    e.stopPropagation();
    isDown = true;
    startX = e.touches[0].clientX;
  }, { passive: true });

  track.addEventListener('touchmove', e => {
    if (!isDown) return;
    e.stopPropagation();
    const diff = startX - e.touches[0].clientX;
    if (Math.abs(diff) > 50) {
      goToSlide(currentSlide + (diff > 0 ? 1 : -1));
      isDown = false;
    }
  }, { passive: true });

  track.addEventListener('touchend', e => {
    e.stopPropagation();
    isDown = false;
  }, { passive: true });

  track.addEventListener('wheel', e => {
    e.stopPropagation();
    e.preventDefault();
    goToSlide(currentSlide + (e.deltaY > 0 ? 1 : -1));
  }, { passive: false });
}

// === CART ===
function addToCart(uuid) {
  if (!cart.includes(uuid)) {
    cart.push(uuid);
    localStorage.setItem('cart', JSON.stringify(cart));
    renderCartCount();
    renderCartItems();
    alert(`Added to cart!`);
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
    container.innerHTML = '<p class="text-gray-500 italic">Cart is empty</p>';
    return;
  }
  container.innerHTML = cart.map(uuid => {
    const item = allItems.find(i => i.UUID === uuid);
    if (!item) return '';
    return `
      <div class="flex items-center gap-3 mb-3 p-2 border rounded">
        <img src="images/${item.Photos[0]}" class="w-16 h-16 object-cover rounded" onerror="this.src='images/placeholder.jpg';">
        <div class="flex-1">
          <p class="font-medium text-sm">${item.Item}</p>
          <p class="text-xs text-gray-600">${item.Location || ''}</p>
        </div>
        <button class="text-red-600 text-sm" onclick="removeFromCart('${uuid}')">Remove</button>
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

async function saveCartToGitHub() {
  if (cart.length === 0) return alert('Cart is empty');
  const payload = { items: cart.map(uuid => {
    const it = allItems.find(i => i.UUID === uuid);
    return { uuid, name: it.Item, thumbnail: it.Photos[0] };
  }), savedAt: new Date().toISOString() };
  const filename = `carts/cart-${Date.now()}.json`;
  const content = btoa(JSON.stringify(payload, null, 2));
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${filename}`, {
      method: 'PUT',
      headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'New cart', content })
    });
    if (!res.ok) throw await res.text();
    alert('Cart saved!');
  } catch (e) {
    console.error(e);
    alert('Failed to save cart');
  }
}