const SERVICES = [
  { key: "decouverte", label: "Découverte", duration: "30 min", price: 180 },
  { key: "eveil", label: "Éveil Scalp", duration: "40 min", price: 250 },
  { key: "beldi", label: "Rituel Beldi Naturel", duration: "50 min", price: 300 },
  { key: "signature", label: "Signature Jeyna", duration: "60 min", price: 400 },
  { key: "premium", label: "Premium Jeyna", duration: "90 min", price: 550 },
];

let selectedService = null;
let weekOffset = 0;
let pendingSlot = null;

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekStart(offset) {
  const today = new Date();
  const day = today.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffToMonday + offset * 7);
  const tuesday = new Date(monday);
  tuesday.setDate(monday.getDate() + 1);
  return formatDate(tuesday);
}

function renderServiceCards() {
  const container = document.getElementById('service-cards');
  container.innerHTML = SERVICES.map(s => `
    <button data-key="${s.key}" class="service-card border-2 rounded-xl p-4 text-left transition ${selectedService === s.key ? 'border-[#8a5a44] bg-[#f6e8de]' : 'border-[#e6d3c6] bg-white'}">
      <div class="font-serif text-lg text-[#8a5a44]">${s.label}</div>
      <div class="text-sm text-[#a8796a]">${s.duration}</div>
      <div class="text-sm font-semibold mt-1">${s.price} MAD</div>
    </button>
  `).join('');

  container.querySelectorAll('.service-card').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedService = btn.dataset.key;
      renderServiceCards();
      document.getElementById('grid-section').classList.remove('hidden');
      loadGrid();
    });
  });
}

async function loadGrid() {
  const gridEl = document.getElementById('grid');
  gridEl.innerHTML = '<p class="text-center py-10 text-[#a8796a]">Chargement...</p>';
  const weekStart = getWeekStart(weekOffset);
  document.getElementById('week-label').textContent = `Semaine du ${weekStart}`;

  try {
    const res = await fetch(`/api/availability?weekStart=${weekStart}&service=${selectedService}`);
    const data = await res.json();
    renderGrid(data.days);
  } catch (e) {
    gridEl.innerHTML = '<p class="text-center py-10 text-red-500">Erreur de chargement</p>';
  }
}

function renderGrid(days) {
  const gridEl = document.getElementById('grid');
  const times = days[0].slots.map(s => s.time);

  let html = '<table class="w-full border-collapse text-xs md:text-sm"><thead><tr>';
  html += '<th class="p-2 border border-[#e6d3c6] bg-[#f6e8de]"></th>';
  days.forEach(d => {
    html += `<th class="p-2 border border-[#e6d3c6] bg-[#f6e8de] font-serif text-[#8a5a44]">${d.label}</th>`;
  });
  html += '</tr></thead><tbody>';

  times.forEach((time, i) => {
    html += `<tr><td class="p-2 border border-[#e6d3c6] bg-[#fdf6f1] font-medium">${time}</td>`;
    days.forEach(d => {
      const slot = d.slots[i];
      let cls = 'bg-gray-100 text-gray-300 cursor-not-allowed';
      let clickable = false;
      if (slot.status === 'available') {
        cls = 'bg-green-100 hover:bg-green-200 cursor-pointer text-green-700';
        clickable = true;
      } else if (slot.status === 'full') {
        cls = 'bg-red-100 text-red-400 cursor-not-allowed';
      }
      html += `<td class="p-2 border border-[#e6d3c6] text-center ${cls}" ${clickable ? `data-date="${d.date}" data-time="${slot.time}"` : ''}>${clickable ? '●' : '—'}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  gridEl.innerHTML = html;

  gridEl.querySelectorAll('td[data-date]').forEach(cell => {
    cell.addEventListener('click', () => openModal(cell.dataset.date, cell.dataset.time));
  });
}

function openModal(date, time) {
  pendingSlot = { date, time };
  const service = SERVICES.find(s => s.key === selectedService);
  document.getElementById('modal-summary').textContent = `${service.label} — ${date} à ${time}`;
  document.getElementById('booking-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('booking-modal').classList.add('hidden');
  document.getElementById('booking-form').reset();
}

async function submitBooking(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Envoi...';

  const name = document.getElementById('client-name').value.trim();
  const phone = document.getElementById('client-phone').value.trim();

  try {
    const res = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: selectedService,
        date: pendingSlot.date,
        time: pendingSlot.time,
        name, phone
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Erreur, réessayez.');
      closeModal();
      loadGrid();
      return;
    }

    const service = SERVICES.find(s => s.key === selectedService);
    const message =
      `Bonjour Jeyna Head Spa 🌸%0A` +
      `Nouvelle réservation :%0A` +
      `Prestation : ${service.label}%0A` +
      `Date : ${pendingSlot.date}%0A` +
      `Heure : ${pendingSlot.time}%0A` +
      `Nom : ${name}%0A` +
      `Téléphone : ${phone}`;

    window.open(`https://wa.me/212669556345?text=${message}`, '_blank');
    closeModal();
    loadGrid();
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Confirmer';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderServiceCards();

  document.getElementById('prev-week').addEventListener('click', () => {
    if (weekOffset > 0) { weekOffset--; loadGrid(); }
  });
  document.getElementById('next-week').addEventListener('click', () => {
    weekOffset++; loadGrid();
  });
  document.getElementById('booking-form').addEventListener('submit', submitBooking);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
});