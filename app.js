// ==== CONFIG ====
const REPO = 'Andrea-Orimoto/sangottardo';
const GITHUB_TOKEN = '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';
const PAGE_SIZE = 12;

let allItems = [], displayed = 0;
let preferiti = JSON.parse(localStorage.getItem('preferiti') || '[]');

document.addEventListener('DOMContentLoaded', init);

/* ========================================
   INIT
   ======================================== */
async function init() {
  await loadCSVAndStatus();
  setupFilters();
  renderGrid();
  renderPreferitiCount();

  document.getElementById('preferitiBtn').onclick = () => togglePreferitiSidebar();
  document.getElementById('closePreferiti').onclick = () => togglePreferitiSidebar(false);
  document.getElementById('loadMore').onclick = () => renderGrid(true);

  const adminLink = document.getElementById('adminLink');
  if (adminLink && localStorage.getItem('adminToken')) adminLink.classList.remove('hidden');
}

/* ========================================
   LOAD DATA
   ======================================== */
async function loadCSVAndStatus() {
  try {
    const resp = await fetch('data/items.csv');
    const text = await resp.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    const map = new Map();

    parsed.data.forEach(row => {
      const uuid = row.UUID;
      if (!uuid) return;
      if (!map.has(uuid)) map.set(uuid, { ...row, Photos: [] });
      const photos = (row.Photos || '').trim().split(/\s+/).filter(Boolean);
      if (photos.length) map.get(uuid).Photos.push(...photos);
    });

    allItems = Array.from(map.values());

    // Load status.json
    try {
      const statusResp = await fetch('data/status.json');
      if (statusResp.ok) {
        const statusData = await statusResp.json();
        allItems.forEach(item => item.Status = statusData[item.UUID] || '');
      }
    } catch (e) { /* no status → all Disponibile */ }

  } catch (e) {
    allItems = [];
  }
}

/* ========================================
   HELPERS
   ======================================== */
function formatPrice(item) {
  const price = item['Purchase Price'];
  const currency = item['Purchase Currency'] || 'EUR';
  return price ? `${price} ${currency}` : '—';
}

/* ========================================
   FILTERS
   ======================================== */
function filterItems() {
  const q = (document.getElementById('search')?.value || '').toLowerCase().trim();
  const loc = document.getElementById('catFilter')?.value || '';
  const status = document.getElementById('statusFilter')?.value || '';

  return allItems.filter(item => {
    const text = [item.Item, item.Location, item.Categories, item.Notes].join(' ').toLowerCase();
    const matchSearch = !q || text.includes(q);
    const matchLoc = !loc || (item.Location || '') === loc;
    const isSold = (item.Status || '').trim() === 'Venduto';
    const matchStatus = !status ||
      (status === 'Disponibile' && !isSold) ||
      (status === 'Venduto' && isSold);
    return matchSearch && matchLoc && matchStatus;
  });
}

function setupFilters() {
  const catSel = document.getElementById('catFilter');
  if (!catSel) return;

  const locations = [...new Set(allItems.map(i => i.Location).filter(Boolean))].sort();
  const count = {};
  allItems.forEach(i => count[i.Location || 'Uncategorized'] = (count[i.Location || 'Uncategorized'] || 0) + 1);

  catSel.innerHTML = `<option value="">Tutte le categorie (${allItems.length})</option>`;
  locations.forEach(loc => {
    catSel.innerHTML += `<option value="${loc}">${loc} (${count[loc]})</option>`;
  });

  // Status filter
  const statusSel = document.createElement('select');
  statusSel.id = 'statusFilter';
  statusSel.className = 'ml-2 p-2 border rounded';
  statusSel.innerHTML = `
    <option value="">Tutti gli stati</option>
    <option value="Disponibile">Disponibile</option>
    <option value="Venduto">Venduto</option>
  `;
  statusSel.onchange = () => { displayed = 0; renderGrid(); };
  document.querySelector('#filters').appendChild(statusSel);

  // Search debounce
  let timeout;
  document.getElementById('search').oninput = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => { displayed = 0; renderGrid(); }, 300);
  };

  // URL param
  catSel.onchange = () => {
    displayed = 0; renderGrid();
    const url = new URL(window.location);
    catSel.value ? url.searchParams.set('cat', catSel.value) : url.searchParams.delete('cat');
    history.replaceState({}, '', url);
  };

  const urlCat = new URLSearchParams(location.search).get('cat');
  if (urlCat && catSel.querySelector(`option[value="${urlCat}"]`)) {
    setTimeout(() => catSel.value = urlCat && catSel.dispatchEvent(new Event('change')), 100);
  }
}

/* ========================================
   GRID
   ======================================== */
function renderGrid(loadMore = false) {
  if (!loadMore) {
    document.getElementById('grid').innerHTML = '';
    displayed = 0;
  }

  const container = document.getElementById('grid');
  const fragment = document.createDocumentFragment();
  const filtered = filterItems();
  const end = Math.min(displayed + PAGE_SIZE, filtered.length);

  for (let i = displayed; i < end; i++) {
    const item = filtered[i];
    const inPref = preferiti.some(p => p.UUID === item.UUID);
    const isSold = (item.Status || '').trim() === 'Venduto';
    const badge = `<span class="${isSold ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'} text-xs px-2 py-1 rounded">${isSold ? 'Venduto' : 'Disponibile'}</span>`;

    const photoBadge = item.Photos.length > 1 ? `
      <div class="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        <span>${item.Photos.length}</span>
      </div>` : '';

    const heart = inPref
      ? `<svg class="w-5 h-5 text-red-500 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
      : `<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`;

    const div = document.createElement('div');
    div.className = 'bg-white rounded overflow-hidden shadow cursor-pointer hover:shadow-lg transition-shadow relative';
    div.innerHTML = `
      <div class="bg-gray-100 flex items-center justify-center rounded-t-lg h-48 relative overflow-hidden">
        <img src="images/${item.Photos[0] || 'placeholder.jpg'}" alt="${item.Item}" class="max-h-full max-w-full object-contain transition-transform hover:scale-105">
        ${photoBadge}
        <button onclick="togglePreferiti('${item.UUID}'); event.stopPropagation();" class="absolute top-2 left-2 bg-white p-1 rounded-full shadow">${heart}</button>
      </div>
      <div class="p-3 h-32 flex flex-col justify-between bg-white">
        <div>
          <h3 class="font-semibold text-sm line-clamp-2 leading-tight">${item.Item}</h3>
          <p class="text-xs text-gray-600 mt-1">Categoria: ${item.Location || '—'}</p>
          <p class="text-xs text-gray-500">Seriale: ${item['Serial No'] || '—'}</p>
        </div>
        <div class="flex justify-between items-center mt-2">
          <p class="text-sm font-medium text-indigo-600">Prezzo: ${formatPrice(item)}</p>
          <div>${badge}</div>
        </div>
      </div>
    `;
    div.onclick = () => openModal(item);
    fragment.appendChild(div);
  }

  container.appendChild(fragment);
  displayed = end;
  document.getElementById('loadMore').classList.toggle('hidden', displayed >= filtered.length);
}

/* ========================================
   MODAL
   ======================================== */
function openModal(item) {
  // === 1. TITOLO + DESCRIZIONE ===
  document.getElementById('modalTitle').textContent = item.Item;
  document.getElementById('modalDesc').innerHTML = `
    <strong>Serial Number:</strong> ${item['Serial No'] || '—'}<br>
    <strong>Category:</strong> ${item.Location || '—'}<br>
    <strong>Scatola:</strong> ${item.Categories || '—'}<br>
    ${item.Notes ? `<strong>Notes:</strong><br><span class="text-sm italic text-gray-700">${item.Notes.replace(/\n/g, '<br>')}</span><br>` : ''}
    ${item['Purchase Date'] ? `<strong>Purchased:</strong> ${item['Purchase Date']}<br>` : ''}
    <strong>Price:</strong> ${formatPrice(item)}
  `;

  // === 2. PULISCI SLIDES ===
  const wrapper = document.getElementById('swiperWrapper');
  wrapper.innerHTML = '';
  item.Photos.forEach((src, i) => {
    const slide = document.createElement('div');
    slide.className = 'swiper-slide flex items-center justify-center bg-gray-100';
    slide.innerHTML = `<img src="images/${src}" alt="${item.Item} ${i+1}" class="max-w-full max-h-full object-contain" onerror="this.src='images/placeholder.jpg'">`;
    wrapper.appendChild(slide);
  });

  // === 3. CUORE TOGGLE ===
  const heartBtn = document.getElementById('modalHeartBtn');
  const inPref = preferiti.some(p => p.UUID === item.UUID);
  heartBtn.innerHTML = inPref
    ? `<svg class="w-6 h-6 text-red-500 fill-current" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`
    : `<svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>`;
  heartBtn.onclick = (e) => {
    e.stopPropagation();
    togglePreferiti(item.UUID);
  };

  // === 4. MOSTRA MODAL (senza Swiper visibile) ===
  const modal = document.getElementById('modal');
  modal.classList.remove('hidden');

  // === 5. INIT SWIPER DOPO REFLOW + AGGIUNGI CLASSE READY ===
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Forza reflow
      void modal.offsetHeight;

      // Destroy old
      if (window.modalSwiper) {
        window.modalSwiper.destroy(true, true);
        window.modalSwiper = null;
      }

      // Init new
      window.modalSwiper = new Swiper('.mySwiper', {
        loop: false,
        pagination: { el: '.swiper-pagination', clickable: true },
        navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
        spaceBetween: 0,
        slidesPerView: 1,
        touchRatio: 1,
        grabCursor: true
      });

      window.modalSwiper.update();

      // MOSTRA SWIPER CON TRANSIZIONE
      document.querySelector('.mySwiper').classList.add('swiper-ready');
    });
  });

  document.getElementById('closeModal').onclick = closeModal;
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  const swiper = document.querySelector('.mySwiper');
  if (swiper) swiper.classList.remove('swiper-ready');
  if (window.modalSwiper) {
    window.modalSwiper.destroy(true, true);
    window.modalSwiper = null;
  }
}

/* ========================================
   PREFERITI
   ======================================== */
function renderPreferitiCount() {
  const el = document.getElementById('preferitiCount');
  if (el) el.textContent = preferiti.length;
}

function togglePreferiti(uuid) {
  const item = allItems.find(i => i.UUID === uuid);
  const idx = preferiti.findIndex(p => p.UUID === uuid);
  idx === -1 ? preferiti.push(item) : preferiti.splice(idx, 1);
  localStorage.setItem('preferiti', JSON.stringify(preferiti));
  renderPreferitiCount();
  renderGrid();
  renderPreferiti();
  if (!document.getElementById('modal').classList.contains('hidden')) openModal(item);
}

function togglePreferitiSidebar(open = null) {
  const sb = document.getElementById('preferitiSidebar');
  open === null ? sb.classList.toggle('translate-x-full') : sb.classList.toggle('translate-x-full', !open);
  if (!sb.classList.contains('translate-x-full')) renderPreferiti();
}

function renderPreferiti() {
  const container = document.getElementById('preferitiItems');
  if (!container) return;
  container.innerHTML = preferiti.length === 0
    ? '<p class="text-gray-500">Nessun elemento nei Preferiti</p>'
    : preferiti.map(item => `
        <div class="border-b py-2 flex justify-between items-center">
          <span>${item.Item}</span>
          <button onclick="togglePreferiti('${item.UUID}'); renderPreferiti();" class="text-red-500 text-sm">Rimuovi</button>
        </div>
      `).join('');
}

/* ========================================
   GOOGLE SIGN-IN
   ======================================== */
function onGoogleSignIn(googleUser) {
  const email = googleUser.getBasicProfile().getEmail();
  fetch('data/admins.json')
    .then(r => r.json())
    .then(admins => {
      if (admins.includes(email)) {
        localStorage.setItem('adminToken', 'google-admin');
        document.getElementById('adminLink').classList.remove('hidden');
        renderGrid();
      }
    });
}