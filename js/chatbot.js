const tarifs = [
  { nom: "Découverte", duree: "30 min", prix: 180,
    desc: "Shampoing, massage crânien, séchage rapide" },
  { nom: "Éveil Scalp", duree: "40 min", prix: 250,
    desc: "Soins du visage, shampoing, soin cheveux en profondeur, massage crânien" },
  { nom: "Rituel Beldi Naturel", duree: "50 min", prix: 300,
    desc: "Soins naturels au sidr/ghassoul, gommage du cuir chevelu, fumigation, massage crânien, massage des mains, soin du visage" },
  { nom: "Signature Jeyna", duree: "60 min", prix: 400,
    desc: "Soin hydratant, gommage du cuir chevelu, botox capillaire, fumigation, massage crânien approfondi, massage des mains, soin du visage" },
  { nom: "Premium Jeyna", duree: "90 min", prix: 550,
    desc: "Rituel Head Spa complet, gommage du cuir chevelu, fumigation prolongée, massage crânien complet, massage nuque/épaules/mains, soin du visage" },
  { nom: "Brushing", duree: "-", prix: "à partir de 25",
    desc: "Selon la longueur et l'épaisseur des cheveux" },
  { nom: "Lissage au tanin", duree: "-", prix: "à partir de 900",
    desc: "Selon la longueur, l'épaisseur et la nature des cheveux" }
];

function normalize(str) {
  return str.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function repondre(question) {
  const q = normalize(question);

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
    return "Contactez-nous directement au 📞 +212 6 69 55 63 45 pour connaître nos horaires du jour.";
  }

  if (q.includes("reserv") || q.includes("rendez")) {
    return `Vous pouvez réserver directement ici 👉 <a href="reservation.html" class="underline text-[#8a5a44]">page réservation</a>`;
  }

  return `Je n'ai pas compris 🙏 Vous pouvez demander : "prix Signature Jeyna", "liste des tarifs", "adresse", ou réserver directement sur la <a href="reservation.html" class="underline text-[#8a5a44]">page réservation</a>.`;
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
      ? "bg-[#8a5a44] text-white self-end ml-auto rounded-lg px-3 py-2 mb-2 max-w-[80%]"
      : "bg-[#f6e8de] text-[#4a3b34] self-start rounded-lg px-3 py-2 mb-2 max-w-[80%]";
    div.innerHTML = html;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function handleSend() {
    const val = input.value.trim();
    if (!val) return;
    addMsg(val, true);
    input.value = "";
    setTimeout(() => addMsg(repondre(val), false), 300);
  }

  send.addEventListener("click", handleSend);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSend();
  });

  addMsg("Bonjour 👋 Je suis l'assistant Jeyna Head Spa. Demandez-moi un prix, par exemple : <i>\"prix Signature Jeyna\"</i>", false);
});