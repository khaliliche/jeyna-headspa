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
    <button data-key="${s.key}" class="service-card border rounded-sm p-4 text-left transition ${selectedService === s.key ? 'border-[#B76E4F] bg-[#E8DED2]/40' : 'border-[#E8DED2] bg-white hover:border-[#B76E4F]'}">
      <div class="font-display text-lg">${s.label}</div>
      <div class="text-xs uppercase tracking-widest text-[#7A8471] mt-1">${s.duration}</div>
      <div class="text-sm font-semibold mt-1">${s.price} MAD</div>
    </button>
  `).join('');

  container.querySelectorAll('.service-card').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedService = btn.dataset.key;
      renderServiceCards();
      unlockGrid();
      loadGrid();
    });
  });
}

function unlockGrid() {
  document.getElementById('grid').classList.remove('opacity-40', 'pointer-events-none');
  document.getElementById('grid-lock').classList.add('hidden');
  document.getElementById('step1-badge').className = 'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold bg-[#4A7856] text-white';
  document.getElementById('step2-badge').className = 'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold bg-[#1F1B19] text-white';
}

async function loadGrid() {
  const gridEl = document.getElementById('grid');
  const weekStart = getWeekStart(weekOffset);
  document.getElementById('week-label').textContent = `Semaine du ${weekStart}`;
  const serviceForPreview = selectedService || 'decouverte';

  try {
    const res = await fetch(`/api/availability?weekStart=${weekStart}&service=${serviceForPreview}`);
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
  html += '<th class="p-2 border border-[#E8DED2] bg-[#E8DED2]/40"></th>';
  days.forEach(d => {
    html += `<th class="p-2 border border-[#E8DED2] bg-[#E8DED2]/40 font-display text-[#1F1B19]">${d.label}</th>`;
  });
  html += '</tr></thead><tbody>';

  times.forEach((time, i) => {
    html += `<tr><td class="p-2 border border-[#E8DED2] bg-[#F7F3EF] font-medium">${time}</td>`;
    days.forEach(d => {
      const slot = d.slots[i];
      let cls = 'bg-gray-50 text-gray-300 cursor-not-allowed';
      let clickable = false;
      if (slot.status === 'available') {
        cls = 'cursor-pointer transition';
        clickable = true;
      } else if (slot.status === 'full') {
        cls = 'cursor-not-allowed';
      }
      let style = '';
      if (slot.status === 'available') style = 'background:#4A7856; color:white;';
      else if (slot.status === 'full') style = 'background:#B76E4F; color:white;';
      html += `<td class="p-2 border border-[#E8DED2] text-center ${cls}" style="${style}" ${clickable ? `data-date="${d.date}" data-time="${slot.time}"` : ''}>${clickable ? '●' : '—'}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  gridEl.innerHTML = html;

  gridEl.querySelectorAll('td[data-date]').forEach(cell => {
    cell.addEventListener('click', () => {
      if (!selectedService) return;
      openModal(cell.dataset.date, cell.dataset.time);
    });
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
  loadGrid();

  document.getElementById('prev-week').addEventListener('click', () => {
    if (!selectedService) return;
    if (weekOffset > 0) { weekOffset--; loadGrid(); }
  });
  document.getElementById('next-week').addEventListener('click', () => {
    if (!selectedService) return;
    weekOffset++; loadGrid();
  });
  document.getElementById('booking-form').addEventListener('submit', submitBooking);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
});