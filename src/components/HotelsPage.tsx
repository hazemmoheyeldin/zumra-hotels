/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Hotel } from '../types';

interface HotelsPageProps {
  hotels: Hotel[];
  onSaveHotel: (hotel: Hotel) => void;
  onDeleteHotel: (id: string) => void;
}

// Google Places API integration (requires API key + CORS proxy)
const GOOGLE_API_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_PLACES_API_KEY) || '';
const CORS_PROXY = 'https://corsproxy.io/?';

async function fetchGooglePlaces(hotelName: string): Promise<{ name: string; address: string; phone: string; rating: number } | null> {
  if (!GOOGLE_API_KEY) return null;
  try {
    const query = encodeURIComponent(`${hotelName} hotel Saudi Arabia`);
    const url = `${CORS_PROXY}${encodeURIComponent(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${GOOGLE_API_KEY}`)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.results && data.results.length > 0) {
      const r = data.results[0];
      return {
        name: r.name || hotelName,
        address: r.formatted_address || '',
        phone: r.formatted_phone_number || '',
        rating: r.rating || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Local mock databases for automatic integration mapping
const PRESET_HOTELS: Partial<Hotel>[] = [
  // === MAKKAH HOTELS ===
  {
    name: 'Swissotel Makkah',
    city: 'Makkah',
    stars: 5,
    address: 'King Abdul Aziz Road, Abraj Al Bait, Makkah',
    contact: '+966 12 571 8000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Kaaba View', 'Haram View', 'City View'],
    mealPlans: ['B.B', 'H.B', 'F.B', 'RO']
  },
  {
    name: 'Pullman Zamzam Makkah',
    city: 'Makkah',
    stars: 5,
    address: 'Abraj Al Bait Complex, Makkah',
    contact: '+966 12 571 5555',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Quint'],
    views: ['Haram View', 'Kaaba View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B']
  },
  {
    name: 'Movenpick Hajar Makkah',
    city: 'Makkah',
    stars: 5,
    address: 'Abraj Al Bait, King Abdul Aziz Road, Makkah 24231',
    contact: '+966 12 571 7777',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View', 'Kaaba View'],
    mealPlans: ['B.B', 'H.B', 'F.B', 'RO']
  },
  {
    name: 'Fairmont Makkah Clock Royal Tower',
    city: 'Makkah',
    stars: 5,
    address: 'Abraj Al Bait Complex, Makkah',
    contact: '+966 12 571 7777',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Suite'],
    views: ['Kaaba View', 'Haram View', 'City View', 'Mountain View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B']
  },
  {
    name: 'Hilton Suites Makkah',
    city: 'Makkah',
    stars: 5,
    address: 'Jabal Omar, Makkah',
    contact: '+966 12 571 5000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['B.B', 'H.B', 'RO']
  },
  {
    name: 'Sheraton Makkah Jabal Al Kaaba',
    city: 'Makkah',
    stars: 5,
    address: 'Jabal Al Kaaba, Makkah',
    contact: '+966 12 571 9000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Kaaba View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B']
  },
  {
    name: 'Le Meridien Towers Makkah',
    city: 'Makkah',
    stars: 5,
    address: 'Kudai Main Road, Makkah',
    contact: '+966 12 553 1111',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B']
  },
  {
    name: 'Conrad Makkah',
    city: 'Makkah',
    stars: 5,
    address: 'Jabal Omar, Makkah',
    contact: '+966 12 571 3000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Quint'],
    views: ['Kaaba View', 'Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B']
  },
  {
    name: 'Dar Al Eiman Royal Hotel',
    city: 'Makkah',
    stars: 5,
    address: 'King Abdul Aziz Road, Makkah',
    contact: '+966 12 571 6000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Quint'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B']
  },
  {
    name: 'Elaf Ajyad Hotel Makkah',
    city: 'Makkah',
    stars: 4,
    address: 'Ajyad Street, Makkah',
    contact: '+966 12 571 4000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B']
  },
  {
    name: 'Raffles Makkah Palace',
    city: 'Makkah',
    stars: 5,
    address: 'Abraj Al Bait, Makkah',
    contact: '+966 12 571 8888',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Suite'],
    views: ['Kaaba View', 'Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B']
  },
  {
    name: 'InterContinental Dar Al Tawhid Makkah',
    city: 'Makkah',
    stars: 5,
    address: 'Ajyad Street, Makkah',
    contact: '+966 12 571 7000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B']
  },
  // === MADINAH HOTELS ===
  {
    name: 'Anwar Al Madinah Mövenpick',
    city: 'Madinah',
    stars: 5,
    address: 'Central Northern Area, Madinah',
    contact: '+966 14 818 1000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B', 'Iftar Ramadan']
  },
  {
    name: 'Dar Al Iman InterContinental',
    city: 'Madinah',
    stars: 5,
    address: 'Central Area, Madinah',
    contact: '+966 14 820 6666',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'Courtyard View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B']
  },
  {
    name: 'Pullman Zamzam Madinah',
    city: 'Madinah',
    stars: 5,
    address: 'Central Area, Madinah',
    contact: '+966 14 818 5000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B']
  },
  {
    name: 'The Oberoi Madinah',
    city: 'Madinah',
    stars: 5,
    address: 'Central Northern Area, Madinah',
    contact: '+966 14 818 2000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Suite'],
    views: ['Haram View', 'Courtyard View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B']
  },
  {
    name: 'Shaza Al Madina',
    city: 'Madinah',
    stars: 5,
    address: 'Central Area, Madinah',
    contact: '+966 14 829 7000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B']
  },
  {
    name: 'Millennium Al Aqah Madinah',
    city: 'Madinah',
    stars: 5,
    address: 'Central Area, Madinah',
    contact: '+966 14 826 1000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B']
  },
  {
    name: 'Taal Bayak Madinah',
    city: 'Madinah',
    stars: 4,
    address: 'Northern Central Area, Madinah',
    contact: '+966 14 825 5000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Quint'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B']
  },
  {
    name: 'Al Aqah Taal Bayak',
    city: 'Madinah',
    stars: 4,
    address: 'Central Area, Madinah',
    contact: '+966 14 825 8000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B']
  }
];
export default function HotelsPage({ hotels, onSaveHotel, onDeleteHotel }: HotelsPageProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form States
  const [name, setName] = useState('');
  const [city, setCity] = useState<'Makkah' | 'Madinah'>('Makkah');
  const [stars, setStars] = useState(5);
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');
  const [reservationsEmail, setReservationsEmail] = useState('');
  const [roomTypes, setRoomTypes] = useState<string>('Single, Double, Triple, Quad, Quint');
  const [views, setViews] = useState<string>('City View, Haram View, Kaaba View');
  const [mealPlans, setMealPlans] = useState<string>('RO, B.B, H.B, F.B');
  const [suppliersText, setSuppliersText] = useState<string>(''); // Suppliers text representation values
  const [isSearching, setIsSearching] = useState<boolean>(false); // Spinner flag
  const [gatherHint, setGatherHint] = useState<string>(''); // Hint message for gather button

  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Auto filling mock Google info
  const handleAutoGatherInfo = async () => {
    if (!name.trim()) {
      const nameInput = document.getElementById('hotel-name-input');
      if (nameInput) {
        nameInput.focus();
        nameInput.classList.add('ring-2', 'ring-rose-400');
        setTimeout(() => nameInput.classList.remove('ring-2', 'ring-rose-400'), 2000);
      }
      setGatherHint('Please type a hotel name first, then click this button.');
      setTimeout(() => setGatherHint(''), 4000);
      return;
    }

    setIsSearching(true);

    // Try Google Places API first
    const googleResult = await fetchGooglePlaces(name.trim());

    setTimeout(() => {
      setIsSearching(false);
      const nameLower = name.trim().toLowerCase();

      if (googleResult) {
        // Use Google Places data
        const isMakkah = nameLower.includes('makkah') || nameLower.includes('makka');
        const isMadinah = nameLower.includes('madinah') || nameLower.includes('madina') || nameLower.includes('medina');
        const detectedCity = isMadinah ? 'Madinah' : (isMakkah ? 'Makkah' : 'Makkah');
        const starsFromRating = Math.min(5, Math.max(3, Math.round(googleResult.rating)));

        setCity(detectedCity as any);
        setStars(starsFromRating);
        setAddress(googleResult.address || `King Abdul Aziz Road, Central Area, ${detectedCity}`);
        setContact(googleResult.phone || (detectedCity === 'Makkah' ? '+966 12 500 9999' : '+966 14 820 9999'));
        setRoomTypes('Single, Double, Triple, Quad, Quint');
        setViews(detectedCity === 'Makkah' ? 'Haram View, Kaaba View, City View' : 'Haram View, City View');
        setMealPlans('RO, B.B, H.B, F.B');
        setSuppliersText(detectedCity === 'Makkah' ? 'Golden Sands Makkah, Marseilia Tours' : 'Zowar Madinah Hospitality');
        setGatherHint(`✅ Found via Google Places: "${googleResult.name}" (Rating: ${googleResult.rating}★) — details auto-filled!`);
        setTimeout(() => setGatherHint(''), 6000);
        return;
      }

      // Fallback to local presets
      let match = PRESET_HOTELS.find(p => p.name?.toLowerCase() === nameLower);
      if (!match) match = PRESET_HOTELS.find(p => p.name?.toLowerCase().includes(nameLower));
      if (!match) match = PRESET_HOTELS.find(p => nameLower.includes(p.name?.toLowerCase() || ''));
      if (!match) {
        const keywords = nameLower.split(/\s+/);
        match = PRESET_HOTELS.find(p => {
          const presetName = p.name?.toLowerCase() || '';
          return keywords.some(kw => kw.length > 3 && presetName.includes(kw));
        });
      }
      
      if (match) {
        setCity(match.city as any);
        setStars(match.stars || 5);
        setAddress(match.address || '');
        setContact(match.contact || '');
        setRoomTypes(match.roomTypes?.join(', ') || '');
        setViews(match.views?.join(', ') || '');
        setMealPlans(match.mealPlans?.join(', ') || '');
        setSuppliersText(match.city === 'Makkah' ? 'Golden Sands Makkah, Marseilia Tours' : 'Zowar Madinah Hospitality');
        setGatherHint(`✅ Found in local database: "${match.name}" — all details auto-filled! Review fields below.`);
        setTimeout(() => setGatherHint(''), 5000);
      } else {
        const isMakkah = nameLower.includes('makkah') || nameLower.includes('makka') || nameLower.includes('makkah');
        const isMadinah = nameLower.includes('madinah') || nameLower.includes('madina') || nameLower.includes('medina');
        const detectedCity = isMadinah ? 'Madinah' : (isMakkah ? 'Makkah' : (city === 'Madinah' ? 'Madinah' : 'Makkah'));
        setCity(detectedCity as any);
        const distText = detectedCity === 'Makkah' ? '180m from Haram Courtyard' : '80m from Al Masjid An Nabawi';
        setAddress(`King Abdul Aziz Road, Central Area, ${detectedCity} (${distText})`);
        setContact(detectedCity === 'Makkah' ? '+966 12 500 9999' : '+966 14 820 9999');
        setRoomTypes('Single, Double, Triple, Quad, Quint');
        setViews(detectedCity === 'Makkah' ? 'Haram View, Kaaba View, City View' : 'Haram View, City View');
        setMealPlans('RO, B.B, H.B, F.B');
        setSuppliersText('Direct Booking Channel, Local DMC Supplier');
        setGatherHint(`✨ Not found in any database — auto-filled default ${detectedCity} data. Click "Search on Google" to find real details.`);
        setTimeout(() => setGatherHint(''), 6000);
      }
    }, googleResult ? 200 : 1200);
  };

  const handleEdit = (hotel: Hotel) => {
    setEditingId(hotel.id);
    setName(hotel.name);
    setCity(hotel.city);
    setStars(hotel.stars);
    setAddress(hotel.address);
    setContact(hotel.contact);
    setReservationsEmail(hotel.reservationsEmail || '');
    setRoomTypes(Array.isArray(hotel.roomTypes) ? hotel.roomTypes.join(', ') : hotel.roomTypes);
    setViews(Array.isArray(hotel.views) ? hotel.views.join(', ') : hotel.views);
    setMealPlans(Array.isArray(hotel.mealPlans) ? hotel.mealPlans.join(', ') : hotel.mealPlans);
    setSuppliersText(hotel.suppliers && Array.isArray(hotel.suppliers) ? hotel.suppliers.join(', ') : '');
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      alert('Please fill out the hotel name.');
      return;
    }

    const newHotel: Hotel = {
      id: editingId || `h_${Date.now()}`,
      name,
      city,
      stars,
      address,
      contact,
      reservationsEmail: reservationsEmail || undefined,
      roomTypes: roomTypes.split(',').map(s => s.trim()).filter(Boolean),
      views: views.split(',').map(s => s.trim()).filter(Boolean),
      mealPlans: mealPlans.split(',').map(s => s.trim()).filter(Boolean),
      suppliers: suppliersText.split(',').map(s => s.trim()).filter(Boolean)
    };

    onSaveHotel(newHotel);
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setCity('Makkah');
    setStars(5);
    setAddress('');
    setContact('');
    setReservationsEmail('');
    setRoomTypes('Single, Double, Triple, Quad, Quint');
    setViews('City View, Haram View, Kaaba View');
    setMealPlans('RO, B.B, H.B, F.B');
    setSuppliersText('');
    setIsSearching(false);
    setGatherHint('');
    setShowForm(false);
  };

  return (
    <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm">
      <div className="border-b border-slate-100 pb-4 mb-6 flex flex-wrap justify-between items-center gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Hotels Directory</h2>
          <p className="text-xs text-slate-500">Configure partner hotels with custom views, meal plans, and room capacities.</p>
        </div>
        <button
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow flex items-center gap-1"
        >
          {showForm ? 'View Hotels List' : 'Add Partner Hotel'}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl bg-slate-50 border border-slate-200/60 p-5 rounded-2xl">
          <div className="flex flex-col gap-2 bg-white p-3 rounded-xl border border-slate-100 mb-2">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase">Hotel Database Lookup</span>
                <p className="text-[9px] text-slate-400 mt-0.5">Search our hotel database or use Google for auto-fill</p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleAutoGatherInfo}
                  disabled={isSearching}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase px-3 py-2 rounded-lg transition flex items-center gap-1.5 shadow-md disabled:opacity-75 cursor-pointer"
                >
                  {isSearching ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Searching...
                    </>
                  ) : (
                    '✨ Gather Details'
                  )}
                </button>
              </div>
            </div>

            {/* Quick Add from Preset Database */}
            <div className="mt-1">
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Quick Add from Database</label>
              <select
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-slate-50 focus:border-amber-500 focus:outline-none"
                value=""
                onChange={(e) => {
                  const preset = PRESET_HOTELS.find(p => p.name === e.target.value);
                  if (preset) {
                    setName(preset.name || '');
                    setCity(preset.city as any);
                    setStars(preset.stars || 5);
                    setAddress(preset.address || '');
                    setContact(preset.contact || '');
                    setRoomTypes(preset.roomTypes?.join(', ') || '');
                    setViews(preset.views?.join(', ') || '');
                    setMealPlans(preset.mealPlans?.join(', ') || '');
                    setSuppliersText(preset.city === 'Makkah' ? 'Golden Sands Makkah, Marseilia Tours' : 'Zowar Madinah Hospitality');
                    setGatherHint(`✅ Loaded from database: "${preset.name}" — review and save.`);
                    setTimeout(() => setGatherHint(''), 5000);
                  }
                }}
              >
                <option value="">-- Select Hotel from Database --</option>
                <optgroup label="Makkah Hotels">
                  {PRESET_HOTELS.filter(p => p.city === 'Makkah').map((p, i) => (
                    <option key={`mk_${i}`} value={p.name}>{p.name} ({p.stars}★)</option>
                  ))}
                </optgroup>
                <optgroup label="Madinah Hotels">
                  {PRESET_HOTELS.filter(p => p.city === 'Madinah').map((p, i) => (
                    <option key={`md_${i}`} value={p.name}>{p.name} ({p.stars}★)</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {gatherHint && (
              <div className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border animate-pulse flex items-center justify-between gap-2 ${
                gatherHint.startsWith('✅') || gatherHint.startsWith('✨') 
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                  : 'text-rose-600 bg-rose-50 border-rose-200'
              }`}>
                <span>{gatherHint}</span>
                {gatherHint.includes('Not found') && name.trim() && (
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(name.trim() + ' hotel Saudi Arabia reservations email phone')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md text-[9px] font-bold no-underline transition"
                  >
                    🔍 Search on Google
                  </a>
                )}
              </div>
            )}
          </div>

          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            {editingId ? 'Edit Hotel Details' : 'New Hotel Specifications'}
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Hotel Full Name</label>
              <input
                type="text"
                value={name}
                id="hotel-name-input"
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Swissotel Makkah"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Holy City</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value as any)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:border-amber-500 focus:outline-none"
              >
                <option value="Makkah">Makkah Al Mukarramah</option>
                <option value="Madinah">Madinah Al Munawwarah</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Stars Class</label>
              <input
                type="number"
                min={1}
                max={5}
                value={stars}
                onChange={(e) => setStars(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Full Physical Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Contact Phone/Email</label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Reservations Email</label>
              <input
                type="email"
                value={reservationsEmail}
                onChange={(e) => setReservationsEmail(e.target.value)}
                placeholder="e.g. reservations@hotelname.com"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Room Types (comma separated)</label>
              <input
                type="text"
                value={roomTypes}
                onChange={(e) => setRoomTypes(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none font-mono text-indigo-700"
              />
            </div>

            <div className="col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Hotel Views (comma separated)</label>
              <input
                type="text"
                value={views}
                onChange={(e) => setViews(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>

            <div className="col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Supported Meal Plans (comma separated)</label>
              <input
                type="text"
                value={mealPlans}
                onChange={(e) => setMealPlans(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>

            <div className="col-span-2 bg-emerald-50/25 p-3 rounded-xl border border-emerald-100">
              <label className="text-[10px] uppercase font-bold text-emerald-850 block mb-1 font-semibold flex items-center gap-1.5">
                <span>🤝</span> Hotel Available Suppliers (comma separated)
              </label>
              <input
                type="text"
                value={suppliersText}
                onChange={(e) => setSuppliersText(e.target.value)}
                placeholder="e.g. Golden Sands Makkah, Marseilia Tours, Zowar Madinah"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none bg-white font-mono"
              />
              <p className="text-[9px] text-emerald-700/80 mt-1 font-serif">Input suppliers who can confirm this hotel, helping employees locate booking channels easily without asking the manager.</p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-2 rounded-lg transition"
            >
              {editingId ? 'Save Specs' : 'Register Hotel'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs px-5 py-2 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px]">🔍</span>
            <input
              type="text"
              placeholder="Search Hotel by name, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-full max-w-sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hotels.filter(h => h.name.toLowerCase().includes(searchTerm.toLowerCase()) || h.city.toLowerCase().includes(searchTerm.toLowerCase())).map((hotel) => (
              <div key={hotel.id} className="border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg transition-all text-xs bg-white overflow-hidden group">
                {/* Header strip */}
                <div className={`px-4 py-3 flex items-center justify-between ${hotel.city === 'Makkah' ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100' : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100'}`}>
                  <div>
                    <h3 className="font-black text-slate-800 text-sm leading-tight">{hotel.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${hotel.city === 'Makkah' ? 'bg-amber-200/50 text-amber-800' : 'bg-emerald-200/50 text-emerald-800'}`}>
                        {hotel.city === 'Makkah' ? '🕋 Makkah' : '🕌 Madinah'}
                      </span>
                      <span className="text-amber-500 font-mono text-[10px]">{'★'.repeat(hotel.stars)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(hotel)} className="p-1.5 bg-white/80 hover:bg-amber-100 rounded-lg transition text-amber-700" title="Edit">✏️</button>
                    <button onClick={() => { if (confirm('Delete this hotel?')) onDeleteHotel(hotel.id); }} className="p-1.5 bg-white/80 hover:bg-red-100 rounded-lg transition text-red-600" title="Delete">🗑️</button>
                  </div>
                </div>

                {/* Quick info */}
                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-start gap-2 text-slate-600">
                    <span className="text-[10px] mt-0.5">📍</span>
                    <span className="text-[10px] leading-tight">{hotel.address || 'No address'}</span>
                  </div>
                  {hotel.contact && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="text-[10px]">📞</span>
                      <span className="text-[10px]">{hotel.contact}</span>
                    </div>
                  )}
                  {hotel.reservationsEmail && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="text-[10px]">✉️</span>
                      <a href={`mailto:${hotel.reservationsEmail}`} className="text-[10px] text-blue-600 hover:underline truncate">{hotel.reservationsEmail}</a>
                    </div>
                  )}
                </div>

                {/* Tags - compact */}
                <div className="px-4 pb-3 space-y-1.5">
                  <div className="flex flex-wrap gap-1">
                    {hotel.roomTypes.map((t, i) => (
                      <span key={i} className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-600">{t}</span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {hotel.mealPlans.map((mp, i) => (
                      <span key={i} className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[9px] font-bold border border-amber-100">{mp}</span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {hotel.views.map((v, i) => (
                      <span key={i} className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[9px] border border-indigo-100">{v}</span>
                    ))}
                  </div>
                </div>

                {/* Suppliers footer */}
                {hotel.suppliers && hotel.suppliers.length > 0 && (
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                    <span className="text-[8px] uppercase font-bold text-slate-400 block mb-1">Suppliers</span>
                    <div className="flex flex-wrap gap-1">
                      {hotel.suppliers.map((s, i) => (
                        <span key={i} className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded text-[9px] font-bold">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
