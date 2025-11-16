// admin.js — Sangottardo Admin Panel
const REPO = 'Andrea-Orimoto/sangottardo';
const GITHUB_TOKEN = 'YOUR_PAT_HERE'; // <-- REPLACE WITH YOUR GITHUB PAT

let carts = [];

// === UTILS ===
async function getFileSha(path) {
  try {
    const resp = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`);
    const data = await resp.json();
    return data.sha;
  } catch (e) {
    return null;
  }
}

// === LOAD CARTS ===
async function loadCarts() {
  try {
    const resp = await fetch('data/carts.json');
    if (resp.ok) {
      carts = await resp.json();
      renderCarts();
    }
  } catch (e) {
    console.error("Failed to load carts", e);
  }
}

// === RENDER CARTS ===
function renderCarts() {
  const container = document.getElementById('cartsContainer');
  if (!container) return;

  if (carts.length === 0) {
    container.innerHTML = '<p class="text-gray-500">No carts yet.</p>';
    return;
  }

  container.innerHTML = carts.map((cart, idx) => `
    <div class="border p-4 rounded mb-4">
      <h3 class="font-semibold">Cart #${idx + 1} — ${cart.userName} (${cart.userEmail})</h3>
      <p class="text-sm text-gray-600">Saved: ${new Date(cart.timestamp).toLocaleString()}</p>
      <div class="mt-2">
        ${cart.items.map(item => `
          <div class="flex justify-between text-sm border-b py-1">
            <span>${item.Item} (${item.Location})</span>
            <span>€${item['Purchase Price'] || 'N/A'}</span>
          </div>
        `).join('')}
      </div>
      <button onclick="deleteCart(${idx})" class="mt-2 bg-red-600 text-white px-3 py-1 rounded text-sm">Delete</button>
    </div>
  `).join('');
}

// === DELETE CART ===
window.deleteCart = async function(index) {
  if (!confirm('Delete this cart?')) return;

  carts.splice(index, 1);
  await saveCarts();
  renderCarts();
};

// === SAVE CARTS ===
async function saveCarts() {
  try {
    const sha = await getFileSha('data/carts.json');
    await fetch(`https://api.github.com/repos/${REPO}/contents/data/carts.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Update carts',
        content: btoa(JSON.stringify(carts, null, 2)),
        sha: sha || undefined
      })
    });
  } catch (e) {
    alert('Failed to save: ' + e.message);
  }
};

// === ADD ADMIN ===
document.getElementById('addAdminBtn')?.addEventListener('click', async () => {
  const emailInput = document.getElementById('newAdminEmail');
  const email = emailInput.value.trim();
  if (!email || !email.includes('@')) {
    document.getElementById('adminMsg').textContent = 'Invalid email';
    return;
  }

  const msg = document.getElementById('adminMsg');
  msg.textContent = 'Adding...';

  try {
    const resp = await fetch('data/admins.json');
    let admins = [];
    if (resp.ok) admins = await resp.json();

    if (admins.includes(email)) {
      msg.textContent = 'Already an admin';
      return;
    }

    admins.push(email);

    const sha = await getFileSha('data/admins.json');
    await fetch(`https://api.github.com/repos/${REPO}/contents/data/admins.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Add admin: ${email}`,
        content: btoa(JSON.stringify(admins, null, 2)),
        sha
      })
    });

    msg.textContent = `Added ${email} as admin!`;
    emailInput.value = '';
  } catch (e) {
    msg.textContent = 'Failed: ' + e.message;
  }
});

// === INIT ===
document.addEventListener('DOMContentLoaded', () => {
  loadCarts();
});