/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Hotel } from '../types';
import { useLang } from '../lib/LanguageContext';
import { showToast } from './Toast';

interface HotelsPageProps {
  hotels: Hotel[];
  onSaveHotel: (hotel: Hotel) => void;
  onDeleteHotel: (id: string) => void;
}

// API Keys
const GOOGLE_API_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_PLACES_API_KEY) || '';
const GEOAPIFY_API_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEOAPIFY_API_KEY) || '';
const CORS_PROXY = 'https://corsproxy.io/?';

// Geoapify Places API - fetch hotel details + coordinates
interface GeoapifyResult {
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  mapUrl: string;
}

async function fetchGeoapify(hotelName: string): Promise<GeoapifyResult | null> {
  if (!GEOAPIFY_API_KEY) return null;
  try {
    // Use Places API for detailed hotel info
    const query = encodeURIComponent(hotelName);
    const url = `https://api.geoapify.com/v2/places?categories=accommodation.hotel&text=${query}&bias=proximity:39.8262,21.4225&limit=1&apiKey=${GEOAPIFY_API_KEY}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.results && data.results.length > 0) {
      const r = data.results[0];
      const lat = r.lat;
      const lon = r.lon;
      return {
        name: r.name || hotelName,
        address: r.formatted || '',
        phone: r.contact?.phone || '',
        lat,
        lng: lon,
        mapUrl: `https://www.google.com/maps?q=${lat},${lon}&z=17`,
      };
    }
    // Fallback to Geocoding API
    const geocodeUrl = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(hotelName + ' hotel Saudi Arabia')}&format=json&limit=1&apiKey=${GEOAPIFY_API_KEY}`;
    const geoResp = await fetch(geocodeUrl, { signal: AbortSignal.timeout(10000) });
    if (!geoResp.ok) return null;
    const geoData = await geoResp.json();
    if (geoData.results && geoData.results.length > 0) {
      const r = geoData.results[0];
      const lat = r.lat;
      const lon = r.lon;
      return {
        name: r.name || hotelName,
        address: r.formatted || '',
        phone: '',
        lat,
        lng: lon,
        mapUrl: `https://www.google.com/maps?q=${lat},${lon}&z=17`,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Google Places API (requires API key + CORS proxy)
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
    mealPlans: ['B.B', 'H.B', 'F.B', 'RO'],
    mapUrl: 'https://www.google.com/maps?q=21.4225,39.8262&z=17',
  },
  {
    name: 'Pullman Zamzam Makkah',
    city: 'Makkah',
    stars: 5,
    address: 'Abraj Al Bait Complex, Makkah',
    contact: '+966 12 571 5555',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Quint'],
    views: ['Haram View', 'Kaaba View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B'],
    mapUrl: 'https://www.google.com/maps?q=21.4225,39.8262&z=17',
  },
  {
    name: 'Movenpick Hajar Makkah',
    city: 'Makkah',
    stars: 5,
    address: 'Abraj Al Bait, King Abdul Aziz Road, Makkah 24231',
    contact: '+966 12 571 7777',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View', 'Kaaba View'],
    mealPlans: ['B.B', 'H.B', 'F.B', 'RO'],
    mapUrl: 'https://www.google.com/maps?q=21.4225,39.8262&z=17',
  },
  {
    name: 'Fairmont Makkah Clock Royal Tower',
    city: 'Makkah',
    stars: 5,
    address: 'Abraj Al Bait Complex, Makkah',
    contact: '+966 12 571 7777',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Suite'],
    views: ['Kaaba View', 'Haram View', 'City View', 'Mountain View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B'],
    mapUrl: 'https://www.google.com/maps?q=21.4225,39.8262&z=17',
  },
  {
    name: 'Hilton Suites Makkah',
    city: 'Makkah',
    stars: 5,
    address: 'Jabal Omar, Makkah',
    contact: '+966 12 571 5000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['B.B', 'H.B', 'RO'],
    mapUrl: 'https://www.google.com/maps?q=21.4225,39.8262&z=17',
  },
  {
    name: 'Sheraton Makkah Jabal Al Kaaba',
    city: 'Makkah',
    stars: 5,
    address: 'Jabal Al Kaaba, Makkah',
    contact: '+966 12 571 9000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Kaaba View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B'],
    mapUrl: 'https://www.google.com/maps?q=21.4225,39.8262&z=17',
  },
  {
    name: 'Le Meridien Towers Makkah',
    city: 'Makkah',
    stars: 5,
    address: 'Kudai Main Road, Makkah',
    contact: '+966 12 553 1111',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B'],
    mapUrl: 'https://www.google.com/maps?q=21.4225,39.8262&z=17',
  },
  {
    name: 'Conrad Makkah',
    city: 'Makkah',
    stars: 5,
    address: 'Jabal Omar, Makkah',
    contact: '+966 12 571 3000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Quint'],
    views: ['Kaaba View', 'Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B'],
    mapUrl: 'https://www.google.com/maps?q=21.4225,39.8262&z=17',
  },
  {
    name: 'Dar Al Eiman Royal Hotel',
    city: 'Makkah',
    stars: 5,
    address: 'King Abdul Aziz Road, Makkah',
    contact: '+966 12 571 6000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Quint'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B'],
    mapUrl: 'https://www.google.com/maps?q=21.4225,39.8262&z=17',
  },
  {
    name: 'Elaf Ajyad Hotel Makkah',
    city: 'Makkah',
    stars: 4,
    address: 'Ajyad Street, Makkah',
    contact: '+966 12 571 4000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B'],
    mapUrl: 'https://www.google.com/maps?q=21.4225,39.8262&z=17',
  },
  {
    name: 'Raffles Makkah Palace',
    city: 'Makkah',
    stars: 5,
    address: 'Abraj Al Bait, Makkah',
    contact: '+966 12 571 8888',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Suite'],
    views: ['Kaaba View', 'Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B'],
    mapUrl: 'https://www.google.com/maps?q=21.4225,39.8262&z=17',
  },
  {
    name: 'InterContinental Dar Al Tawhid Makkah',
    city: 'Makkah',
    stars: 5,
    address: 'Ajyad Street, Makkah',
    contact: '+966 12 571 7000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B'],
    mapUrl: 'https://www.google.com/maps?q=21.4225,39.8262&z=17',
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
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B', 'Iftar Ramadan'],
    mapUrl: 'https://www.google.com/maps?q=24.4686,39.6142&z=17',
  },
  {
    name: 'Dar Al Iman InterContinental',
    city: 'Madinah',
    stars: 5,
    address: 'Central Area, Madinah',
    contact: '+966 14 820 6666',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'Courtyard View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B'],
    mapUrl: 'https://www.google.com/maps?q=24.4686,39.6142&z=17',
  },
  {
    name: 'Pullman Zamzam Madinah',
    city: 'Madinah',
    stars: 5,
    address: 'Central Area, Madinah',
    contact: '+966 14 818 5000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B'],
    mapUrl: 'https://www.google.com/maps?q=24.4686,39.6142&z=17',
  },
  {
    name: 'The Oberoi Madinah',
    city: 'Madinah',
    stars: 5,
    address: 'Central Northern Area, Madinah',
    contact: '+966 14 818 2000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Suite'],
    views: ['Haram View', 'Courtyard View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B'],
    mapUrl: 'https://www.google.com/maps?q=24.4686,39.6142&z=17',
  },
  {
    name: 'Shaza Al Madina',
    city: 'Madinah',
    stars: 5,
    address: 'Central Area, Madinah',
    contact: '+966 14 829 7000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B'],
    mapUrl: 'https://www.google.com/maps?q=24.4686,39.6142&z=17',
  },
  {
    name: 'Millennium Al Aqah Madinah',
    city: 'Madinah',
    stars: 5,
    address: 'Central Area, Madinah',
    contact: '+966 14 826 1000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B'],
    mapUrl: 'https://www.google.com/maps?q=24.4686,39.6142&z=17',
  },
  {
    name: 'Taal Bayak Madinah',
    city: 'Madinah',
    stars: 4,
    address: 'Northern Central Area, Madinah',
    contact: '+966 14 825 5000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Quint'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B', 'F.B'],
    mapUrl: 'https://www.google.com/maps?q=24.4686,39.6142&z=17',
  },
  {
    name: 'Al Aqah Taal Bayak',
    city: 'Madinah',
    stars: 4,
    address: 'Central Area, Madinah',
    contact: '+966 14 825 8000',
    roomTypes: ['Single', 'Double', 'Triple', 'Quad'],
    views: ['Haram View', 'City View'],
    mealPlans: ['RO', 'B.B', 'H.B'],
    mapUrl: 'https://www.google.com/maps?q=24.4686,39.6142&z=17',
  }
];

export default function HotelsPage({ hotels, onSaveHotel, onDeleteHotel }: HotelsPageProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const { t, lang } = useLang();
  
  // Form States
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [city, setCity] = useState<string>('Makkah');
  const [stars, setStars] = useState(5);
  const [address, setAddress] = useState('');
  const [contact, setContact] = useState('');
  const [reservationsEmail, setReservationsEmail] = useState('');
  const [roomTypes, setRoomTypes] = useState<string>('Single, Double, Triple, Quad, Quint');
  const [views, setViews] = useState<string>('City View, Haram View, Kaaba View');
  const [mealPlans, setMealPlans] = useState<string>('RO, B.B, H.B, F.B');
  const [suppliersText, setSuppliersText] = useState<string>('');
  const [mapUrl, setMapUrl] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isGoogleSearching, setIsGoogleSearching] = useState<boolean>(false);
  const [gatherHint, setGatherHint] = useState<string>('');

  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStars, setFilterStars] = useState('');

  // Geoapify gather - primary lookup
  const handleGeoapifyGather = async () => {
    if (!name.trim()) {
      flashNameInput();
      setGatherHint('Please type a hotel name first, then click this button.');
      setTimeout(() => setGatherHint(''), 4000);
      return;
    }
    if (!GEOAPIFY_API_KEY) {
      setGatherHint('Geoapify API key not configured. Add VITE_GEOAPIFY_API_KEY to your environment or use "Search on Google" instead.');
      setTimeout(() => setGatherHint(''), 6000);
      return;
    }

    setIsSearching(true);
    const result = await fetchGeoapify(name.trim());

    setTimeout(() => {
      setIsSearching(false);
      const nameLower = name.trim().toLowerCase();

      if (result) {
        const isMakkah = nameLower.includes('makkah') || nameLower.includes('makka');
        const isMadinah = nameLower.includes('madinah') || nameLower.includes('madina') || nameLower.includes('medina');
        const detectedCity = isMadinah ? 'Madinah' : (isMakkah ? 'Makkah' : 'Makkah');

        setCity(detectedCity as any);
        setStars(5);
        setAddress(result.address || `${detectedCity}`);
        if (result.phone) setContact(result.phone);
        if (result.mapUrl) setMapUrl(result.mapUrl);
        setRoomTypes('Single, Double, Triple, Quad, Quint');
        setViews(detectedCity === 'Makkah' ? 'Haram View, Kaaba View, City View' : 'Haram View, City View');
        setMealPlans('RO, B.B, H.B, F.B');
        setSuppliersText(detectedCity === 'Makkah' ? 'Golden Sands Makkah, Marseilia Tours' : 'Zowar Madinah Hospitality');
        setGatherHint(`✅ Found via Geoapify: "${result.name}" — address & map location auto-filled!`);
        setTimeout(() => setGatherHint(''), 6000);
        return;
      }

      // Fallback to local presets
      const match = findPresetMatch(nameLower);
      if (match) {
        applyPreset(match);
        setGatherHint(`✅ Found in local database: "${match.name}" — all details auto-filled!`);
        setTimeout(() => setGatherHint(''), 5000);
      } else {
        const detectedCity = detectCity(nameLower);
        setCity(detectedCity as any);
        setAddress(`King Abdul Aziz Road, Central Area, ${detectedCity}`);
        setContact(detectedCity === 'Makkah' ? '+966 12 500 9999' : '+966 14 820 9999');
        setRoomTypes('Single, Double, Triple, Quad, Quint');
        setViews(detectedCity === 'Makkah' ? 'Haram View, Kaaba View, City View' : 'Haram View, City View');
        setMealPlans('RO, B.B, H.B, F.B');
        setSuppliersText('Direct Booking Channel, Local DMC Supplier');
        setGatherHint(`✨ Not found via Geoapify — auto-filled default ${detectedCity} data. Try "Search on Google" for real details.`);
        setTimeout(() => setGatherHint(''), 6000);
      }
    }, result ? 200 : 1200);
  };

  // Google search gather
  const handleGoogleGather = async () => {
    if (!name.trim()) {
      flashNameInput();
      setGatherHint('Please type a hotel name first, then click this button.');
      setTimeout(() => setGatherHint(''), 4000);
      return;
    }

    if (GOOGLE_API_KEY) {
      setIsGoogleSearching(true);
      const googleResult = await fetchGooglePlaces(name.trim());
      setIsGoogleSearching(false);

      if (googleResult) {
        const nameLower = name.trim().toLowerCase();
        const detectedCity = detectCity(nameLower);
        setCity(detectedCity as any);
        setStars(Math.min(5, Math.max(3, Math.round(googleResult.rating))));
        setAddress(googleResult.address || '');
        setContact(googleResult.phone || '');
        setRoomTypes('Single, Double, Triple, Quad, Quint');
        setViews(detectedCity === 'Makkah' ? 'Haram View, Kaaba View, City View' : 'Haram View, City View');
        setMealPlans('RO, B.B, H.B, F.B');
        setSuppliersText(detectedCity === 'Makkah' ? 'Golden Sands Makkah, Marseilia Tours' : 'Zowar Madinah Hospitality');
        setGatherHint(`✅ Found via Google Places: "${googleResult.name}" (Rating: ${googleResult.rating}★) — details auto-filled!`);
        setTimeout(() => setGatherHint(''), 6000);
        return;
      }
    }

    // Open Google search in new tab as fallback
    const searchQuery = encodeURIComponent(`${name.trim()} hotel Saudi Arabia address phone email`);
    window.open(`https://www.google.com/search?q=${searchQuery}`, '_blank');
    setGatherHint('🔍 Opened Google search in a new tab. Copy details back here when found.');
    setTimeout(() => setGatherHint(''), 5000);
  };

  // Generate Google Maps URL from current address
  const handleFindOnMaps = () => {
    if (!address.trim() && !name.trim()) {
      setGatherHint('Please enter a hotel name or address first.');
      setTimeout(() => setGatherHint(''), 3000);
      return;
    }
    const query = encodeURIComponent(`${name.trim()} ${address.trim()} Saudi Arabia`);
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    setMapUrl(mapsUrl);
    setGatherHint(`📍 Map location generated from address. Verify the link is correct before saving.`);
    setTimeout(() => setGatherHint(''), 5000);
  };

  // Helper functions
  const flashNameInput = () => {
    const nameInput = document.getElementById('hotel-name-input');
    if (nameInput) {
      nameInput.focus();
      nameInput.classList.add('ring-2', 'ring-rose-400');
      setTimeout(() => nameInput.classList.remove('ring-2', 'ring-rose-400'), 2000);
    }
  };

  const detectCity = (nameLower: string): string => {
    const isMadinah = nameLower.includes('madinah') || nameLower.includes('madina') || nameLower.includes('medina');
    if (isMadinah) return 'Madinah';
    return 'Makkah';
  };

  const findPresetMatch = (nameLower: string): Partial<Hotel> | undefined => {
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
    return match;
  };

  const applyPreset = (preset: Partial<Hotel>) => {
    setCity(preset.city as any);
    setStars(preset.stars || 5);
    setAddress(preset.address || '');
    setContact(preset.contact || '');
    setRoomTypes(preset.roomTypes?.join(', ') || '');
    setViews(preset.views?.join(', ') || '');
    setMealPlans(preset.mealPlans?.join(', ') || '');
    setSuppliersText(preset.city === 'Makkah' ? 'Golden Sands Makkah, Marseilia Tours' : 'Zowar Madinah Hospitality');
    if (preset.mapUrl) setMapUrl(preset.mapUrl);
  };

  const handleEdit = (hotel: Hotel) => {
    setEditingId(hotel.id);
    setName(hotel.name);
    setNameAr(hotel.nameAr || '');
    setCity(hotel.city);
    setStars(hotel.stars);
    setAddress(hotel.address);
    setContact(hotel.contact);
    setReservationsEmail(hotel.reservationsEmail || '');
    setRoomTypes(Array.isArray(hotel.roomTypes) ? hotel.roomTypes.join(', ') : hotel.roomTypes);
    setViews(Array.isArray(hotel.views) ? hotel.views.join(', ') : hotel.views);
    setMealPlans(Array.isArray(hotel.mealPlans) ? hotel.mealPlans.join(', ') : hotel.mealPlans);
    setSuppliersText(hotel.suppliers && Array.isArray(hotel.suppliers) ? hotel.suppliers.join(', ') : '');
    setMapUrl(hotel.mapUrl || '');
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      showToast('Please fill out the hotel name.', 'warning');
      return;
    }

    const newHotel: Hotel = {
      id: editingId || `h_${Date.now()}`,
      name,
      nameAr: nameAr.trim() || undefined,
      city,
      stars,
      address,
      contact,
      reservationsEmail: reservationsEmail || undefined,
      roomTypes: roomTypes.split(',').map(s => s.trim()).filter(Boolean),
      views: views.split(',').map(s => s.trim()).filter(Boolean),
      mealPlans: mealPlans.split(',').map(s => s.trim()).filter(Boolean),
      suppliers: suppliersText.split(',').map(s => s.trim()).filter(Boolean),
      mapUrl: mapUrl.trim() || undefined,
    };

    onSaveHotel(newHotel);
    resetForm();
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setNameAr('');
    setCity('Makkah');
    setStars(5);
    setAddress('');
    setContact('');
    setReservationsEmail('');
    setRoomTypes('Single, Double, Triple, Quad, Quint');
    setViews('City View, Haram View, Kaaba View');
    setMealPlans('RO, B.B, H.B, F.B');
    setSuppliersText('');
    setMapUrl('');
    setIsSearching(false);
    setIsGoogleSearching(false);
    setGatherHint('');
    setShowForm(false);
  };

  return (
    <div className="bg-white border border-slate-150 rounded-2xl p-4 md:p-6 shadow-sm">
      <div className="border-b border-slate-100 pb-4 mb-6 flex flex-wrap justify-between items-center gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{t('hotels.title')}</h2>
          <p className="text-xs text-slate-500">{lang === 'ar' ? 'إدارة الفنادق الشريكة مع الإطلالات وأنواع الوجبات والغرف.' : 'Configure partner hotels with custom views, meal plans, and room capacities.'}</p>
        </div>
        <button
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow flex items-center gap-1"
        >
          {showForm ? (lang === 'ar' ? 'عرض الفنادق' : 'View Hotels List') : t('hotels.addHotel')}
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl bg-slate-50 border border-slate-200/60 p-5 rounded-2xl">
          {/* Lookup Section */}
          <div className="flex flex-col gap-3 bg-white p-4 rounded-xl border border-slate-100 mb-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-700 uppercase">Hotel Data Lookup</span>
                <p className="text-[9px] text-slate-400">Search our database, Geoapify, or Google for auto-fill</p>
              </div>
            </div>

            {/* Three lookup buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGeoapifyGather}
                disabled={isSearching || isGoogleSearching}
                className="flex-1 min-w-[120px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase px-3 py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-60 cursor-pointer"
              >
                {isSearching ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Searching...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Geoapify Lookup
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleGoogleGather}
                disabled={isSearching || isGoogleSearching}
                className="flex-1 min-w-[120px] bg-white hover:bg-blue-50 text-blue-700 font-bold text-[10px] uppercase px-3 py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 shadow border border-blue-200 disabled:opacity-60 cursor-pointer"
              >
                {isGoogleSearching ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Searching...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Google Search
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleFindOnMaps}
                disabled={isSearching || isGoogleSearching}
                className="flex-1 min-w-[120px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase px-3 py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-60 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                Find on Maps
              </button>
            </div>

            {/* Quick Add from Preset Database */}
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Quick Add from Database</label>
              <select
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-slate-50 focus:border-amber-500 focus:outline-none"
                value=""
                onChange={(e) => {
                  const preset = PRESET_HOTELS.find(p => p.name === e.target.value);
                  if (preset) {
                    setName(preset.name || '');
                    applyPreset(preset);
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

            {/* Hint / Status message */}
            {gatherHint && (
              <div className={`text-[10px] font-semibold px-3 py-2 rounded-lg border flex items-center gap-2 ${
                gatherHint.startsWith('✅') || gatherHint.startsWith('📍')
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : gatherHint.startsWith('🔍')
                  ? 'text-blue-700 bg-blue-50 border-blue-200'
                  : 'text-rose-600 bg-rose-50 border-rose-200'
              }`}>
                <span className="flex-1">{gatherHint}</span>
                <button type="button" onClick={() => setGatherHint('')} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
              </div>
            )}
          </div>

          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            {editingId ? 'Edit Hotel Details' : 'New Hotel Specifications'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Hotel Full Name (English)</label>
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

            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Hotel Name (Arabic / الاسم بالعربية)</label>
              <input
                type="text"
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="e.g. سويسوتيل مكة"
                dir="rtl"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none text-right"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">City</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:border-amber-500 focus:outline-none"
              >
                <option value="Makkah">Makkah Al Mukarramah</option>
                <option value="Madinah">Madinah Al Munawwarah</option>
                <option value="Jeddah">Jeddah</option>
                <option value="Riyadh">Riyadh</option>
                <option value="Dubai">Dubai</option>
                <option value="Cairo">Cairo</option>
                <option value="Istanbul">Istanbul</option>
                <option value="London">London</option>
                <option value="Other">Other</option>
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

            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Full Physical Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Contact Phone/Email</label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Reservations Email</label>
              <input
                type="email"
                value={reservationsEmail}
                onChange={(e) => setReservationsEmail(e.target.value)}
                placeholder="e.g. reservations@hotelname.com"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Map URL field */}
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1 flex items-center gap-1">
                <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Google Maps Location Link
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={mapUrl}
                  onChange={(e) => setMapUrl(e.target.value)}
                  placeholder="e.g. https://www.google.com/maps?q=21.4225,39.8262"
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none"
                />
                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition flex items-center gap-1 shrink-0"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    Open
                  </a>
                )}
              </div>
              <p className="text-[9px] text-slate-400 mt-0.5">Use "Find on Maps" to auto-generate, or paste a Google Maps link manually</p>
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Room Types (comma separated)</label>
              <input
                type="text"
                value={roomTypes}
                onChange={(e) => setRoomTypes(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none font-mono text-indigo-700"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Hotel Views (comma separated)</label>
              <input
                type="text"
                value={views}
                onChange={(e) => setViews(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>

            <div className="md:col-span-2">
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <span className="text-[10px]">🔍</span>
              <input
                type="text"
                placeholder="Search by name, city, Arabic name, or hotel #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-full max-w-sm"
              />
            </div>
            <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
              <option value="">All Cities</option>
              {[...new Set(hotels.map(h => h.city))].sort().map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterStars} onChange={(e) => setFilterStars(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs">
              <option value="">All Stars</option>
              <option value="5">★★★★★</option>
              <option value="4">★★★★</option>
              <option value="3">★★★</option>
              <option value="2">★★</option>
              <option value="1">★</option>
            </select>
            <span className="text-[10px] text-slate-400 font-semibold">{hotels.filter(h =>
              (!searchTerm || h.name.toLowerCase().includes(searchTerm.toLowerCase()) || h.city.toLowerCase().includes(searchTerm.toLowerCase()) || (h.nameAr && h.nameAr.includes(searchTerm)) || (h.hotelNumber && h.hotelNumber.toString() === searchTerm)) &&
              (!filterCity || h.city === filterCity) &&
              (!filterStars || h.stars === parseInt(filterStars))
            ).length} / {hotels.length} hotels</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hotels.filter(h =>
              (!searchTerm || h.name.toLowerCase().includes(searchTerm.toLowerCase()) || h.city.toLowerCase().includes(searchTerm.toLowerCase()) || (h.nameAr && h.nameAr.includes(searchTerm)) || (h.hotelNumber && h.hotelNumber.toString() === searchTerm)) &&
              (!filterCity || h.city === filterCity) &&
              (!filterStars || h.stars === parseInt(filterStars))
            ).map((hotel) => (
              <div key={hotel.id} className="border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg transition-all text-xs bg-white overflow-hidden group">
                {/* Header strip */}
                <div className={`px-4 py-3 flex items-center justify-between ${
                  hotel.city === 'Makkah' ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100' : 
                  hotel.city === 'Madinah' ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100' :
                  'bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100'
                }`}>
                  <div>
                    <h3 className="font-black text-slate-800 text-sm leading-tight">
                      {hotel.hotelNumber && <span className="text-[9px] font-mono text-slate-400 mr-1.5">#{hotel.hotelNumber}</span>}
                      {hotel.name}
                    </h3>
                    {hotel.nameAr && <p className="text-[10px] text-slate-500 font-semibold mt-0.5" dir="rtl">{hotel.nameAr}</p>}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                        hotel.city === 'Makkah' ? 'bg-amber-200/50 text-amber-800' : 
                        hotel.city === 'Madinah' ? 'bg-emerald-200/50 text-emerald-800' :
                        'bg-blue-200/50 text-blue-800'
                      }`}>
                        {hotel.city === 'Makkah' ? '🕋 Makkah' : hotel.city === 'Madinah' ? '🕌 Madinah' : `📍 ${hotel.city}`}
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
                    <svg className="w-3 h-3 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span className="text-[10px] leading-tight">{hotel.address || 'No address'}</span>
                  </div>
                  {hotel.contact && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      <span className="text-[10px]">{hotel.contact}</span>
                    </div>
                  )}
                  {hotel.reservationsEmail && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      <a href={`mailto:${hotel.reservationsEmail}`} className="text-[10px] text-blue-600 hover:underline truncate">{hotel.reservationsEmail}</a>
                    </div>
                  )}
                </div>

                {/* Tags */}
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

                {/* Location + Suppliers footer */}
                <div className="border-t border-slate-100">
                  {/* Location button */}
                  {hotel.mapUrl && (
                    <a
                      href={hotel.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 transition group/link"
                    >
                      <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                      <span className="text-[10px] font-semibold flex-1">View on Google Maps</span>
                      <svg className="w-3 h-3 text-emerald-500 group-hover/link:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                  )}
                  {/* Suppliers */}
                  {hotel.suppliers && hotel.suppliers.length > 0 && (
                    <div className="px-4 py-2 bg-slate-50">
                      <span className="text-[8px] uppercase font-bold text-slate-400 block mb-1">Suppliers</span>
                      <div className="flex flex-wrap gap-1">
                        {hotel.suppliers.map((s, i) => (
                          <span key={i} className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded text-[9px] font-bold">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
