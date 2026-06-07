/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hotel Seed Data - Bulk import for Zumra Hotels RMS
 */

import { Hotel } from '../types';
import { ZumraDB } from './storage';

// Seed data: Comprehensive hotel list with bilingual names
const HOTEL_SEED_DATA: Omit<Hotel, 'id'>[] = [
  // === MAKKAH HOTELS ===
  { hotelNumber: 1, name: 'Al Salah Ajyad', nameAr: 'الصلاح اجياد', city: 'Makkah', stars: 3, address: 'Ajyad, Makkah', contact: '', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 2, name: 'Swissotel Al Maqam Makkah', nameAr: 'سويسوتيل المقام مكة', city: 'Makkah', stars: 5, address: 'Abraj Al Bait, Makkah', contact: '+966 12 571 8000', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Kaaba View', 'Haram View', 'City View'], mealPlans: ['B.B', 'H.B', 'F.B', 'RO'] },
  { hotelNumber: 3, name: 'Pullman Zamzam Makkah', nameAr: 'بولمان زمزم مكة', city: 'Makkah', stars: 5, address: 'Abraj Al Bait Complex, Makkah', contact: '+966 12 571 5555', roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Quint'], views: ['Haram View', 'Kaaba View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 4, name: 'Movenpick Hajar Makkah', nameAr: 'موڤنبيك هاجر مكة', city: 'Makkah', stars: 5, address: 'Abraj Al Bait, King Abdul Aziz Road', contact: '+966 12 571 7777', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View', 'Kaaba View'], mealPlans: ['B.B', 'H.B', 'F.B', 'RO'] },
  { hotelNumber: 5, name: 'Fairmont Makkah Clock Royal Tower', nameAr: 'فيرمونت مكة برج الساعة الملكي', city: 'Makkah', stars: 5, address: 'Abraj Al Bait Complex, Makkah', contact: '+966 12 571 7777', roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Suite'], views: ['Kaaba View', 'Haram View', 'City View', 'Mountain View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 6, name: 'Hilton Suites Makkah', nameAr: 'هيلتون سويتس مكة', city: 'Makkah', stars: 5, address: 'Jabal Omar, Makkah', contact: '+966 12 571 5000', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['B.B', 'H.B', 'RO'] },
  { hotelNumber: 7, name: 'Sheraton Makkah Jabal Al Kaaba', nameAr: 'شيراتون مكة جبل الكعبة', city: 'Makkah', stars: 5, address: 'Jabal Al Kaaba, Makkah', contact: '+966 12 571 9000', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Kaaba View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 8, name: 'Conrad Makkah', nameAr: 'كونراد مكة', city: 'Makkah', stars: 5, address: 'Jabal Omar, Makkah', contact: '+966 12 571 3000', roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Quint'], views: ['Kaaba View', 'Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 9, name: 'Raffles Makkah Palace', nameAr: 'رافلز مكة بالاس', city: 'Makkah', stars: 5, address: 'Abraj Al Bait, Makkah', contact: '+966 12 571 8888', roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Suite'], views: ['Kaaba View', 'Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 10, name: 'InterContinental Dar Al Tawhid Makkah', nameAr: 'إنتركونتيننتال دار التوحيد مكة', city: 'Makkah', stars: 5, address: 'Ajyad Street, Makkah', contact: '+966 12 571 7000', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 11, name: 'Dar Al Eiman Royal Hotel', nameAr: 'دار الإيمان رويال', city: 'Makkah', stars: 5, address: 'King Abdul Aziz Road, Makkah', contact: '+966 12 571 6000', roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Quint'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 12, name: 'Elaf Ajyad Hotel Makkah', nameAr: 'إيلاف اجياد مكة', city: 'Makkah', stars: 4, address: 'Ajyad Street, Makkah', contact: '+966 12 571 4000', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B'] },
  { hotelNumber: 13, name: 'Le Meridien Towers Makkah', nameAr: 'لو ميريديان أبراج مكة', city: 'Makkah', stars: 5, address: 'Kudai Main Road, Makkah', contact: '+966 12 553 1111', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B'] },
  { hotelNumber: 14, name: 'Al Safwah Royale Orchid', nameAr: 'الصفوة رويال أوركيد', city: 'Makkah', stars: 5, address: 'Ajyad Street, Makkah', contact: '', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 15, name: 'Hilton Makkah Convention Hotel', nameAr: 'هيلتون مكة للمؤتمرات', city: 'Makkah', stars: 5, address: 'Al Naseem, Makkah', contact: '', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B'] },
  { hotelNumber: 16, name: 'Anjum Hotel Makkah', nameAr: 'فندق أنجم مكة', city: 'Makkah', stars: 5, address: 'Al Shisha District, Makkah', contact: '', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 17, name: 'Al Marwa Rayhaan Rotana', nameAr: 'المروة ريحان روتانا', city: 'Makkah', stars: 5, address: 'Al Marwa, Makkah', contact: '', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B'] },
  { hotelNumber: 18, name: 'Millennium Makkah Al Naseem', nameAr: 'ميلينيوم مكة النسيم', city: 'Makkah', stars: 5, address: 'Al Naseem, Makkah', contact: '', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 19, name: 'Makkah Hotel', nameAr: 'فندق مكة', city: 'Makkah', stars: 4, address: 'Central Area, Makkah', contact: '', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B'] },
  { hotelNumber: 20, name: 'Voco Makkah', nameAr: 'فوكو مكة', city: 'Makkah', stars: 5, address: 'Ibrahim Al Khalil, Makkah', contact: '', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B'] },

  // === MADINAH HOTELS ===
  { hotelNumber: 101, name: 'Anwar Al Madinah Mövenpick', nameAr: 'أنوار المدينة موڤنبيك', city: 'Madinah', stars: 5, address: 'Central Northern Area, Madinah', contact: '+966 14 818 1000', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 102, name: 'Dar Al Iman InterContinental', nameAr: 'دار الإيمان إنتركونتيننتال', city: 'Madinah', stars: 5, address: 'Central Area, Madinah', contact: '+966 14 820 6666', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'Courtyard View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 103, name: 'Pullman Zamzam Madinah', nameAr: 'بولمان زمزم المدينة', city: 'Madinah', stars: 5, address: 'Central Area, Madinah', contact: '+966 14 818 5000', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 104, name: 'The Oberoi Madinah', nameAr: 'أوبروي المدينة', city: 'Madinah', stars: 5, address: 'Central Northern Area, Madinah', contact: '+966 14 818 2000', roomTypes: ['Single', 'Double', 'Triple', 'Quad', 'Suite'], views: ['Haram View', 'Courtyard View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 105, name: 'Shaza Al Madina', nameAr: 'شذا المدينة', city: 'Madinah', stars: 5, address: 'Central Area, Madinah', contact: '+966 14 829 7000', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 106, name: 'Millennium Al Aqah Madinah', nameAr: 'ميلينيوم العقبة المدينة', city: 'Madinah', stars: 5, address: 'Central Area, Madinah', contact: '+966 14 826 1000', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 107, name: 'Elaf Al Meshal Hotel', nameAr: 'إيلاف المشعل', city: 'Madinah', stars: 4, address: 'Central Area, Madinah', contact: '', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B'] },
  { hotelNumber: 108, name: 'Al Aqah Taal Bayak', nameAr: 'العقبة تال بياك', city: 'Madinah', stars: 4, address: 'Central Area, Madinah', contact: '+966 14 825 8000', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B'] },
  { hotelNumber: 109, name: 'Dallah Taiba Hotel', nameAr: 'فندق دلة طيبة', city: 'Madinah', stars: 4, address: 'Sultana Road, Madinah', contact: '', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 110, name: 'Rawdat Al Aqeeq Hotel', nameAr: 'روضة العقيق', city: 'Madinah', stars: 4, address: 'Al Aqeeq, Madinah', contact: '', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 111, name: 'Crowne Plaza Madinah', nameAr: 'كراون بلازا المدينة', city: 'Madinah', stars: 5, address: 'Central Area, Madinah', contact: '', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B', 'F.B'] },
  { hotelNumber: 112, name: 'Taal Bayak Al Madina', nameAr: 'تال بياك المدينة', city: 'Madinah', stars: 4, address: 'Central Area, Madinah', contact: '', roomTypes: ['Single', 'Double', 'Triple', 'Quad'], views: ['Haram View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B'] },

  // === JEDDAH HOTELS ===
  { hotelNumber: 201, name: 'Waldorf Astoria Jeddah - Qasr Al Sharq', nameAr: 'والدورف أستوريا جدة - قصر الشرق', city: 'Jeddah', stars: 5, address: 'Corniche Road, Jeddah', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Sea View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 202, name: 'Rosewood Jeddah', nameAr: 'روزوود جدة', city: 'Jeddah', stars: 5, address: 'Corniche Road, Jeddah', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Sea View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 203, name: 'Assila, a Ritz-Carlton Hotel', nameAr: 'أصيلا فندق ريتز كارلتون', city: 'Jeddah', stars: 5, address: 'Prince Mohammed Bin Abdulaziz Street', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Sea View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 204, name: 'InterContinental Jeddah', nameAr: 'إنتركونتيننتال جدة', city: 'Jeddah', stars: 5, address: 'Corniche Road, Jeddah', contact: '', roomTypes: ['Single', 'Double', 'Triple'], views: ['Sea View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 205, name: 'Hilton Jeddah', nameAr: 'هيلتون جدة', city: 'Jeddah', stars: 5, address: 'Corniche Road, Jeddah', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Sea View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 206, name: 'Movenpick Hotel Jeddah', nameAr: 'موڤنبيك جدة', city: 'Jeddah', stars: 5, address: 'Madina Road, Jeddah', contact: '', roomTypes: ['Single', 'Double', 'Triple'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 207, name: 'Sheraton Jeddah Hotel', nameAr: 'شيراتون جدة', city: 'Jeddah', stars: 5, address: 'North Corniche Road', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Sea View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 208, name: 'Radisson Blu Hotel Jeddah', nameAr: 'راديسون بلو جدة', city: 'Jeddah', stars: 5, address: 'Madina Road, Jeddah', contact: '', roomTypes: ['Single', 'Double', 'Triple'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 209, name: 'Holiday Inn Jeddah Gateway', nameAr: 'هوليداي إن جدة جيت واي', city: 'Jeddah', stars: 4, address: 'Madina Road, Jeddah', contact: '', roomTypes: ['Single', 'Double'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 210, name: 'Park Hyatt Jeddah', nameAr: 'بارك حياة جدة', city: 'Jeddah', stars: 5, address: 'Corniche Road, Jeddah', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Sea View', 'City View'], mealPlans: ['RO', 'B.B'] },

  // === RIYADH HOTELS ===
  { hotelNumber: 301, name: 'Al Faisaliah Hotel, a Rosewood Hotel', nameAr: 'فندق الفيصلية روزوود', city: 'Riyadh', stars: 5, address: 'King Fahad Road, Riyadh', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 302, name: 'Four Seasons Hotel Riyadh', nameAr: 'فور سيزونز الرياض', city: 'Riyadh', stars: 5, address: 'Kingdom Centre, Riyadh', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 303, name: 'Ritz-Carlton Riyadh', nameAr: 'ريتز كارلتون الرياض', city: 'Riyadh', stars: 5, address: 'King Abdulaziz Road, Riyadh', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 304, name: 'InterContinental Riyadh', nameAr: 'إنتركونتيننتال الرياض', city: 'Riyadh', stars: 5, address: 'King Abdulaziz Road, Riyadh', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 305, name: 'Hilton Riyadh Hotel & Residences', nameAr: 'هيلتون الرياض', city: 'Riyadh', stars: 5, address: 'King Fahad Road, Riyadh', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 306, name: 'Sheraton Riyadh Hotel & Towers', nameAr: 'شيراتون الرياض', city: 'Riyadh', stars: 5, address: 'King Fahad Road, Riyadh', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 307, name: 'Marriott Riyadh Hotel', nameAr: 'ماريوت الرياض', city: 'Riyadh', stars: 5, address: 'King Fahad Road, Riyadh', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 308, name: 'Hyatt Regency Riyadh', nameAr: 'حياة ريجنسي الرياض', city: 'Riyadh', stars: 5, address: 'Al Olaya District, Riyadh', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 309, name: 'Radisson Blu Hotel Riyadh', nameAr: 'راديسون بلو الرياض', city: 'Riyadh', stars: 5, address: 'King Abdulaziz Road, Riyadh', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 310, name: 'Crowne Plaza Riyadh', nameAr: 'كراون بلازا الرياض', city: 'Riyadh', stars: 5, address: 'King Fahad Road, Riyadh', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View'], mealPlans: ['RO', 'B.B'] },

  // === DUBAI HOTELS ===
  { hotelNumber: 401, name: 'Burj Al Arab Jumeirah', nameAr: 'برج العرب جميرا', city: 'Dubai', stars: 5, address: 'Jumeirah, Dubai', contact: '', roomTypes: ['Suite'], views: ['Sea View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 402, name: 'Atlantis The Palm', nameAr: 'أتلانتس النخلة', city: 'Dubai', stars: 5, address: 'Palm Jumeirah, Dubai', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Sea View', 'Palm View'], mealPlans: ['RO', 'B.B', 'H.B'] },
  { hotelNumber: 403, name: 'Armani Hotel Dubai', nameAr: 'أرماني فندق دبي', city: 'Dubai', stars: 5, address: 'Burj Khalifa, Dubai', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View', 'Fountain View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 404, name: 'Jumeirah Emirates Towers', nameAr: 'جميرا أبراج الإمارات', city: 'Dubai', stars: 5, address: 'Sheikh Zayed Road, Dubai', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 405, name: 'The Address Downtown Dubai', nameAr: 'العنوان داون تاون دبي', city: 'Dubai', stars: 5, address: 'Downtown Dubai', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Burj View', 'Fountain View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 406, name: 'Madinat Jumeirah', nameAr: 'مدينة جميرا', city: 'Dubai', stars: 5, address: 'Jumeirah, Dubai', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Sea View', 'City View'], mealPlans: ['RO', 'B.B', 'H.B'] },
  { hotelNumber: 407, name: 'One&Only The Palm', nameAr: 'وان آند أونلي النخلة', city: 'Dubai', stars: 5, address: 'Palm Jumeirah, Dubai', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Sea View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 408, name: 'Raffles Dubai', nameAr: 'رافلز دبي', city: 'Dubai', stars: 5, address: 'Wafi, Dubai', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 409, name: 'Park Hyatt Dubai', nameAr: 'بارك حياة دبي', city: 'Dubai', stars: 5, address: 'Dubai Creek, Dubai', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Creek View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 410, name: 'Grand Hyatt Dubai', nameAr: 'غراند حياة دبي', city: 'Dubai', stars: 5, address: 'Dubai Creek, Dubai', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Creek View', 'City View'], mealPlans: ['RO', 'B.B'] },

  // === CAIRO HOTELS ===
  { hotelNumber: 501, name: 'Four Seasons Hotel Cairo at Nile Plaza', nameAr: 'فور سيزونز القاهرة نايل بلازا', city: 'Cairo', stars: 5, address: 'Corniche El Nil, Cairo', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Nile View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 502, name: 'Kempinski Nile Hotel Cairo', nameAr: 'كمبنiski نايل القاهرة', city: 'Cairo', stars: 5, address: 'Corniche El Nil, Cairo', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Nile View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 503, name: 'Marriott Mena House', nameAr: 'ماريوت مينا هاوس', city: 'Cairo', stars: 5, address: 'Giza, Cairo', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Pyramids View', 'Garden View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 504, name: 'Conrad Cairo', nameAr: 'كونراد القاهرة', city: 'Cairo', stars: 5, address: 'Corniche El Nil, Cairo', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Nile View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 505, name: 'InterContinental Cairo Semiramis', nameAr: 'إنتركونتيننتال القاهرة سميراميس', city: 'Cairo', stars: 5, address: 'Corniche El Nil, Cairo', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Nile View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 506, name: 'Fairmont Nile City', nameAr: 'فيرمونت نايل سيتي', city: 'Cairo', stars: 5, address: 'Nile City, Cairo', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Nile View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 507, name: 'St. Regis Cairo', nameAr: 'سانت ريجيس القاهرة', city: 'Cairo', stars: 5, address: 'Corniche El Nil, Cairo', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Nile View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 508, name: 'Le Méridien Cairo Airport', nameAr: 'لو ميريديان القاهرة المطار', city: 'Cairo', stars: 5, address: 'Cairo Airport, Cairo', contact: '', roomTypes: ['Single', 'Double'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 509, name: 'Hilton Cairo Grand Nile', nameAr: 'هيلتون القاهرة جراند نايل', city: 'Cairo', stars: 5, address: 'Corniche El Nil, Cairo', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Nile View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 510, name: 'Hilton Cairo Zamalek', nameAr: 'هيلتون القاهرة الزمالك', city: 'Cairo', stars: 5, address: 'Zamalek, Cairo', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Nile View', 'City View'], mealPlans: ['RO', 'B.B'] },

  // === ISTANBUL HOTELS ===
  { hotelNumber: 601, name: 'Four Seasons Hotel Istanbul at the Bosphorus', nameAr: 'فور سيزونز اسطنبول البوسفور', city: 'Istanbul', stars: 5, address: 'Besiktas, Istanbul', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Bosphorus View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 602, name: 'Ciragan Palace Kempinski Istanbul', nameAr: 'قصر سيركجي كمبنسكي اسطنبول', city: 'Istanbul', stars: 5, address: 'Besiktas, Istanbul', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Bosphorus View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 603, name: 'Shangri-La Bosphorus Istanbul', nameAr: 'شانغريلا البوسفور اسطنبول', city: 'Istanbul', stars: 5, address: 'Besiktas, Istanbul', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Bosphorus View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 604, name: 'Raffles Istanbul', nameAr: 'رافلز اسطنبول', city: 'Istanbul', stars: 5, address: 'Zorlu Center, Istanbul', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Bosphorus View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 605, name: 'Mandarin Oriental Bosphorus Istanbul', nameAr: 'ماندرين أورينتال البوسفور', city: 'Istanbul', stars: 5, address: 'Besiktas, Istanbul', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Bosphorus View', 'City View'], mealPlans: ['RO', 'B.B'] },

  // === LONDON HOTELS ===
  { hotelNumber: 701, name: 'The Savoy', nameAr: 'فندق سافوي', city: 'London', stars: 5, address: 'Strand, London', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['Thames View', 'City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 702, name: 'The Ritz London', nameAr: 'ريتز لندن', city: 'London', stars: 5, address: 'Piccadilly, London', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 703, name: 'Claridge\'s', nameAr: 'كلاريدجز', city: 'London', stars: 5, address: 'Mayfair, London', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 704, name: 'The Dorchester', nameAr: 'دورشيستر', city: 'London', stars: 5, address: 'Park Lane, London', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
  { hotelNumber: 705, name: 'InterContinental London Park Lane', nameAr: 'إنتركونتيننتال لندن بارك لين', city: 'London', stars: 5, address: 'Park Lane, London', contact: '', roomTypes: ['Single', 'Double', 'Suite'], views: ['City View'], mealPlans: ['RO', 'B.B'] },
];

/**
 * Seed hotels into the system if empty or if force flag is set
 * @param force - If true, replaces all existing hotels with seed data
 */
export function seedHotelsIfEmpty(force: boolean = false): Hotel[] {
  const existing = ZumraDB.getHotels();
  
  if (force || existing.length === 0) {
    console.log(`[HotelSeed] Seeding ${HOTEL_SEED_DATA.length} hotels...`);
    
    const seededHotels: Hotel[] = HOTEL_SEED_DATA.map((h, idx) => ({
      ...h,
      id: h.hotelNumber ? `seed_${h.hotelNumber}` : `seed_${idx + 1}`,
    }));
    
    ZumraDB.saveHotels(seededHotels);
    console.log(`[HotelSeed] Successfully seeded ${seededHotels.length} hotels`);
    return seededHotels;
  }
  
  console.log(`[HotelSeed] Hotels already exist (${existing.length}), skipping seed`);
  return existing;
}

/**
 * Get the count of seed hotels
 */
export function getSeedHotelCount(): number {
  return HOTEL_SEED_DATA.length;
}
