const tarifs = [
  { key: "decouverte", nom: "Découverte", duree: "30 min", prix: 180,
    desc: "Shampoing, massage crânien, séchage rapide" },
  { key: "eveil", nom: "Éveil Scalp", duree: "40 min", prix: 250,
    desc: "Soins du visage, shampoing, soin cheveux en profondeur, massage crânien" },
  { key: "beldi", nom: "Rituel Beldi Naturel", duree: "50 min", prix: 300,
    desc: "Soins naturels au sidr/ghassoul, gommage du cuir chevelu, fumigation, massage crânien, massage des mains, soin du visage" },
  { key: "signature", nom: "Signature Jeyna", duree: "60 min", prix: 400,
    desc: "Soin hydratant, gommage du cuir chevelu, botox capillaire, fumigation, massage crânien approfondi, massage des mains, soin du visage" },
  { key: "premium", nom: "Premium Jeyna", duree: "90 min", prix: 550,
    desc: "Rituel Head Spa complet, gommage du cuir chevelu, fumigation prolongée, massage crânien complet, massage nuque/épaules/mains, soin du visage" },
  { key: null, nom: "Brushing", duree: "-", prix: "à partir de 25",
    desc: "Selon la longueur et l'épaisseur des cheveux" },
  { key: null, nom: "Lissage au tanin", duree: "-", prix: "à partir de 900",
    desc: "Selon la longueur, l'épaisseur et la nature des cheveux" }
];

const DAY_NAMES_FULL = ["dimanche","lundi","mardi","mercredi","jeudi","vendredi","samedi"];

function normalize(str) {
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatDateISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTuesdayWeekStart(targetDate) {
  const day = targetDate.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(targetDate);
  monday.setDate(targetDate.getDate() - diffToMonday);
  const tuesday = new Date(monday);
  tuesday.setDate(monday.getDate() + 1);
  return tuesday;
}

function detectService(q) {
  for (const t of tarifs) {
    if (!t.key) continue;
    if (q.includes(normalize(t.nom.split(" ")[0])) || q.includes(normalize(t.nom))) {
      return t.key;
    }
  }
  return null;
}

function detectDate(q) {
  const today = new Date();
  today.setHours(0,0,0,0);

  if (q.includes("aujourd")) return today;
  if (q.includes("demain")) {
    const d = new Date(today); d.setDate(d.getDate() + 1); return d;
  }

  for (let i = 0; i < DAY_NAMES_FULL.length; i++) {
    if (q.includes(DAY_NAMES_FULL[i])) {
      const d = new Date(today);
      const currentDay = d.getDay();
      let diff = (i - currentDay + 7) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);
      return d;
    }
  }

  const dateMatch = q.match(/(\d{1,2})[\/\-](\d{1,2})/);
  if (dateMatch) {
    const d = new Date(today.getFullYear(), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[1]));
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    return d;
  }

  return null;
}

async function checkAvailability(question) {
  const q = normalize(question);
  const targetDate = detectDate(q);

  if (!targetDate) {
    return "Pour vérifier les disponibilités, précisez un jour 🙏 Exemple : <i>\"dispo demain\"</i>, <i>\"places libres mardi\"</i>, ou <i>\"créneaux le 15/08\"</i>.";
  }

  if (targetDate.getDay() === 1) {
    return "Nous sommes fermés le lundi 🙏 Choisissez un autre jour (mardi à dimanche, 10h-20h).";
  }

  let serviceKey = detectService(q);
  const serviceUsed = serviceKey || "decouverte";
  const serviceLabel = tarifs.find(t => t.key === serviceUsed)?.nom || "Découverte";

  try {
    const weekStart = formatDateISO(getTuesdayWeekStart(targetDate));
    const res = await fetch(`/api/availability?weekStart=${weekStart}&service=${serviceUsed}`);
    const data = await res.json();

    const targetISO = formatDateISO(targetDate);
    const day = data.days.find(d => d.date === targetISO);

    if (!day) {
      return "Je n'ai pas trouvé ce jour, réessayez avec une autre date 🙏";
    }

    const freeSlots = day.slots.filter(s => s.status === 'available').map(s => s.time);

    if (freeSlots.length === 0) {
      return `Aucun créneau libre le <b>${day.label}</b> pour <b>${serviceLabel}</b> 😔 Essayez un autre jour ou une <a href="reservation.html" class="underline text-[#B76E4F]">autre prestation</a>.`;
    }

    const shown = freeSlots.slice(0, 8).join(", ");
    const more = freeSlots.length > 8 ? ` (+${freeSlots.length - 8} autres)` : "";

    return `Le <b>${day.label}</b>, pour <b>${serviceLabel}</b>, voici les créneaux libres :<br>🟢 ${shown}${more}<br><br>Réservez directement ici 👉 <a href="reservation.html" class="underline text-[#B76E4F]">page réservation</a>`;
  } catch (e) {
    return "Erreur en vérifiant les disponibilités, réessayez dans un instant 🙏";
  }
}

async function repondre(question) {
  const q = normalize(question);

  if (q.includes("dispo") || q.includes("libre") || q.includes("creneau") || q.includes("reste") || (q.includes("place") && !q.includes("remplace"))) {
    return await checkAvailability(question);
  }

  const trouve = tarifs.find(t => q.includes(normalize(t.nom.split(" ")[0])) || q.includes(normalize(t.nom)));
  if (trouve) {
    return `<b>${trouve.nom}</b> — ${trouve.duree} — <b>${trouve.prix} MAD</b><br>${trouve.desc}`;
  }

  if (q.includes("prix") || q.includes("tarif") || q.includes("combien") || q.includes("liste")) {
    return "Voici nos prestations :<br>" + tarifs.map(t =>
      `• ${t.nom} (${t.duree}) — ${t.prix} MAD`
    ).join("<br>");
  }

  if (q.includes("adresse") || q.includes("ou") || q.includes("localisation")) {
    return "📍 Résidence Kouta, 1er étage, 4 rue Ibn Tammam, Kénitra, Maroc";
  }

  if (q.includes("horaire") || q.includes("ouvert")) {
    return "Nous sommes ouverts du mardi au dimanche, de 10h00 à 20h00. Fermé le lundi.";
  }

  if (q.includes("reserv") || q.includes("rendez")) {
    return `Vous pouvez réserver directement ici 👉 <a href="reservation.html" class="underline text-[#B76E4F]">page réservation</a>`;
  }

  return `Je n'ai pas compris 🙏 Vous pouvez demander : "prix Signature Jeyna", "dispo demain", "créneaux libres mardi", "adresse", ou réserver directement sur la <a href="reservation.html" class="underline text-[#B76E4F]">page réservation</a>.`;
}

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("chat-toggle");
  const box = document.getElementById("chat-box");
  const messages = document.getElementById("chat-messages");
  const input = document.getElementById("chat-input");
  const send = document.getElementById("chat-send");

  if (!toggle) return;

  toggle.addEventListener("click", () => {
    box.classList.toggle("hidden");
  });

  function addMsg(html, fromUser) {
    const div = document.createElement("div");
    div.className = fromUser
      ? "bg-[#1F1B19] text-white self-end ml-auto rounded-sm px-3 py-2 mb-2 max-w-[80%]"
      : "bg-[#E8DED2] text-[#1F1B19] self-start rounded-sm px-3 py-2 mb-2 max-w-[80%]";
    div.innerHTML = html;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  async function handleSend() {
    const val = input.value.trim();
    if (!val) return;
    addMsg(val, true);
    input.value = "";
    addMsg("...", false);
    const thinkingMsg = messages.lastChild;
    const response = await repondre(val);
    thinkingMsg.innerHTML = response;
    messages.scrollTop = messages.scrollHeight;
  }

  send.addEventListener("click", handleSend);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSend();
  });

  addMsg("Bonjour 👋 Je suis l'assistant Jeyna Head Spa. Demandez-moi un prix, ou <i>\"dispo demain\"</i> pour voir les créneaux libres.", false);
});