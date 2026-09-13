// Generare sau preluare ID unic pentru dispozitivul curent
let deviceId = localStorage.getItem('brailaHubDeviceId');
if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('brailaHubDeviceId', deviceId);
}

function cleanExpiredListings() {
    let listings = JSON.parse(localStorage.getItem('brailaHubListings')) || [];
    const now = Date.now();
    const fiveDaysInMs = 5 * 24 * 60 * 60 * 1000;
    const validListings = listings.filter(item => (now - item.createdAt) < fiveDaysInMs);
    localStorage.setItem('brailaHubListings', JSON.stringify(validListings));
    return validListings;
}

let listings = cleanExpiredListings();

const providers = JSON.parse(localStorage.getItem('brailaHubProviders')) || [];
const subCountEl = document.getElementById('subscriberCount');
if(subCountEl) subCountEl.innerText = listings.length > 0 ? listings.length : 1;

const container = document.getElementById('listingsContainer');
const searchInput = document.getElementById('searchInput');
const locationFilter = document.getElementById('locationFilter');
const categoryFilter = document.getElementById('categoryFilter');
const activeCount = document.getElementById('activeCount');

function renderListings(data) {
    if(!container) return;
    container.innerHTML = "";
    if(activeCount) activeCount.innerText = `${data.length} active`;
    
    if (data.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-16 bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
                <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 text-2xl">
                    <i class="fa-solid fa-box-open"></i>
                </div>
                <p class="text-slate-700 font-bold text-base">Nicio ofertă activă găsită.</p>
                <p class="text-slate-400 text-xs mt-1">Fii primul care publică o ofertă în județul Brăila!</p>
            </div>
        `;
        return;
    }

    data.forEach(item => {
        const card = document.createElement('div');
        card.className = "bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden transition hover:shadow-lg flex flex-col justify-between";
        
        let imageHtml = '';
        if (item.image) {
            imageHtml = `<div class="h-48 w-full overflow-hidden bg-slate-100 relative">
                <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover">
                <span class="absolute top-3 left-3 bg-slate-900/70 backdrop-blur-md text-white text-xs font-semibold px-3 py-1 rounded-full">${item.category}</span>
            </div>`;
        }

        let addressHtml = item.address ? `<p class="text-xs text-slate-600 mt-1.5 flex items-center gap-1.5 font-medium"><i class="fa-solid fa-map-pin text-rose-500"></i> <span class="bg-rose-50 text-rose-800 px-2 py-0.5 rounded-lg border border-rose-100">${item.address}</span></p>` : '';

        let contactButtonsHtml = '';
        if (item.phone && item.phone.trim().length >= 6) {
            contactButtonsHtml = `
                <div class="flex gap-2">
                    <a href="https://wa.me/4${item.phone}?text=Salut,%20am%20văzut%20oferta%20pe%20Brăila%20Hub:%20${encodeURIComponent(item.title)}" target="_blank" class="bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-600 transition shadow-sm">
                        <i class="fa-brands fa-whatsapp"></i> WhatsApp
                    </a>
                    <a href="tel:${item.phone}" class="bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-slate-800 transition shadow-sm">
                        <i class="fa-solid fa-phone"></i> Sună
                    </a>
                </div>
            `;
        } else {
            contactButtonsHtml = `<span class="text-[11px] text-slate-400 italic">Contact la adresă / magazin</span>`;
        }

        // Butonul de ștergere afișat direct pentru a putea gestiona ofertele ușor
        let deleteButtonHtml = `
            <button onclick="deleteListing(${item.id})" title="Șterge oferta" class="text-slate-300 hover:text-red-500 transition p-1">
                <i class="fa-solid fa-trash-can text-sm"></i>
            </button>
        `;

        card.innerHTML = `
            <div>
                ${imageHtml}
                <div class="p-5">
                    ${!item.image ? `<span class="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full inline-block mb-3">${item.category}</span>` : ''}
                    
                    <div class="flex justify-between items-start gap-2">
                        <h3 class="font-bold text-slate-800 text-base leading-snug mb-1">${item.title}</h3>
                        ${deleteButtonHtml}
                    </div>
                    
                    <p class="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                        <i class="fa-solid fa-store text-emerald-600"></i> <strong class="text-slate-700">${item.provider}</strong> 
                        <span class="text-slate-300">•</span> 
                        <i class="fa-solid fa-location-dot text-rose-500"></i> ${item.location}
                    </p>
                    ${addressHtml}
                    
                    <p class="text-xs text-slate-600 my-3 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">${item.description}</p>
                </div>
            </div>

            <div class="p-5 pt-0 flex items-center justify-between border-t border-slate-100 mt-2">
                <span class="font-extrabold text-emerald-600 text-base">${item.price}</span>
                ${contactButtonsHtml}
            </div>
        `;
        container.appendChild(card);
    });
}

function deleteListing(id) {
    if (confirm("Sigur doriți să ștergeți această ofertă?")) {
        let currentListings = JSON.parse(localStorage.getItem('brailaHubListings')) || [];
        const updated = currentListings.filter(item => item.id !== id);
        localStorage.setItem('brailaHubListings', JSON.stringify(updated));
        listings = updated;
        filterListings();
    }
}

function addNewListing(listingData) {
    let currentListings = JSON.parse(localStorage.getItem('brailaHubListings')) || [];
    
    const myDeviceListings = currentListings.filter(item => item.deviceId === deviceId);
    if (myDeviceListings.length >= 3) {
        alert("Ați atins limita maximă de 3 anunțuri active per dispozitiv.");
        return false;
    }

    const newEntry = {
        ...listingData,
        id: Date.now(),
        deviceId: deviceId,
        createdAt: Date.now()
    };

    currentListings.unshift(newEntry);
    localStorage.setItem('brailaHubListings', JSON.stringify(currentListings));
    listings = currentListings;
    filterListings();
    return true;
}

function filterListings() {
    if(!searchInput) return;
    const searchTerm = searchInput.value.toLowerCase();
    const selectedLocation = locationFilter.value;
    const selectedCategory = categoryFilter.value;

    const filtered = listings.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm) || item.description.toLowerCase().includes(searchTerm) || item.provider.toLowerCase().includes(searchTerm) || item.category.toLowerCase().includes(searchTerm);
        const matchesLocation = selectedLocation === "" || item.location === selectedLocation;
        const matchesCategory = selectedCategory === "" || item.category === selectedCategory;
        return matchesSearch && matchesLocation && matchesCategory;
    });

    renderListings(filtered);
}

function selectCategory(categoryName) {
    if (categoryFilter) {
        categoryFilter.value = categoryName;
        filterListings();
        const listingsContainer = document.getElementById('listingsContainer');
        if (listingsContainer) {
            listingsContainer.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

if(searchInput) searchInput.addEventListener('input', filterListings);
if(locationFilter) locationFilter.addEventListener('change', filterListings);
if(categoryFilter) categoryFilter.addEventListener('change', filterListings);

const ads = [
    { title: "Vânzări directe în județul Brăila!", text: "Conectează-te cu clienții locali rapid și fără comisioane." },
    { title: "Pește proaspăt și produse pescărești", text: "Găsește cele mai bune oferte direct de pe malul Dunării." },
    { title: "Ești producător sau deții un magazin?", text: "Publică ofertele tale și crește-ți vânzările local gratuit." }
];
let currentAd = 0;
setInterval(() => {
    currentAd = (currentAd + 1) % ads.length;
    const adTitle = document.getElementById('adTitle');
    const adText = document.getElementById('adText');
    if(adTitle && adText) {
        adTitle.innerText = ads[currentAd].title;
        adText.innerText = ads[currentAd].text;
    }
}, 5000);

let audio = document.getElementById('bgMusic');
let isMusicPlaying = false;
let audioUnlocked = false;

function unlockAudioOnFirstClick() {
    if (!audioUnlocked && audio) {
        audioUnlocked = true;
        audio.volume = 0.3;
        audio.play().then(() => {
            isMusicPlaying = true;
            updateMusicUI(true);
        }).catch(e => console.log("Redare audio amânată de browser:", e));
    }
}

function toggleMusic(event) {
    event.stopPropagation();
    if (!audio) return;
    
    if (isMusicPlaying) {
        audio.pause();
        isMusicPlaying = false;
        updateMusicUI(false);
    } else {
        audio.volume = document.getElementById('volumeSlider').value;
        audio.play().then(() => {
            isMusicPlaying = true;
            updateMusicUI(true);
        }).catch(e => alert("Apasă o singură dată oriunde pe pagină pentru a debloca fluxul audio."));
    }
}

function changeVolume(event, val) {
    event.stopPropagation();
    if(audio) {
        audio.volume = val;
        if(val > 0 && !isMusicPlaying) {
            audio.play().then(() => {
                isMusicPlaying = true;
                updateMusicUI(true);
            });
        } else if(val == 0 && isMusicPlaying) {
            audio.pause();
            isMusicPlaying = false;
            updateMusicUI(false);
        }
    }
}

function updateMusicUI(isPlaying) {
    const icon = document.getElementById('musicIcon');
    const label = document.getElementById('musicLabel');
    if(icon && label) {
        if(isPlaying) {
            icon.className = "fa-solid fa-volume-high text-sm text-emerald-300";
            label.innerText = "Pornită";
        } else {
            icon.className = "fa-solid fa-volume-xmark text-sm text-slate-400";
            label.innerText = "Oprită";
        }
    }
}

renderListings(listings);

setInterval(async () => {
    try {
        if (typeof window.supabase !== 'undefined' || typeof supabase !== 'undefined') {
            const client = window.supabase || supabase;
            await client.from('anunturi').select('id').limit(1);
        }
    } catch (err) {
        console.log('Ping preventiv efectuat');
    }
}, 240000);