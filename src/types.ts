/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Hotel {
  id: string;
  name: string;
  city: 'Makkah' | 'Madinah';
  stars: number;
  address: string;
  contact: string;
  reservationsEmail?: string; // Hotel reservations department email
  roomTypes: string[];
  views: string[];
  mealPlans: string[];
  suppliers?: string[]; // Supplier agent IDs who have/provide this hotel
  mapUrl?: string; // Google Maps location URL for navigation
}

export type AgentType = 'Customer' | 'Supplier' | 'Both';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
}

export interface AmendmentEntry {
  id: string;
  timestamp: string;
  user: string;
  field: string;
  oldValue: string;
  newValue: string;
}

export type EntityType = 'Reservation' | 'Transaction' | 'Agent' | 'User' | 'Hotel' | 'Allotment' | 'Login' | 'OtherService' | 'PaymentGateway' | 'GeneralData' | 'EditApproval';

export interface GlobalAuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  entityType: EntityType;
  entityId: string;
  detail: string;
}

export interface Agent {
  id: string;
  agentNumber: number; // For Agent # column (sequential auto-incrementing)
  name: string;
  companyName: string;
  country: string;
  type: AgentType;
  phone: string;
  email: string;
  address: string;
  balance: number;
  walletBalance?: number; // Available credit balance from cancellations
  pendingRefunds?: RefundAlert[];
  creditLimit?: number; // Optional credit limit for clients
  clientStatus?: 'Active' | 'Suspended' | 'Blacklisted'; // Client status flag
  auditLogs: AuditLogEntry[];
}

export interface RefundAlert {
  id: string;
  bookingId: number;
  amount: number;
  party: 'Client' | 'Supplier';
  partyId: string;
  status: 'Pending' | 'Confirmed' | 'Processed';
  createdAt: string;
  note?: string;
}

export interface AllotmentDay {
  total: number;
  booked: number;
}

export interface AllotmentRatePeriod {
  startDate: string;
  endDate: string;
  costPerNight: number;       // Buy rate per room per night
  sellRatePerNight: number;   // Sell rate per room per night
  extraBedRate?: number;       // Sell extra bed rate per night
  extraBedBuyRate?: number;    // Buy extra bed rate per night
  mealRate?: number;           // Sell meal rate per person per night
  mealBuyRate?: number;        // Buy meal rate per person per night
}

export interface Allotment {
  id: string;
  hotelId: string;
  roomType: string;
  supplierId: string;
  startDate: string;
  endDate: string;
  totalRooms: number;
  bookedRooms: number;
  dailyAvailability?: { [date: string]: AllotmentDay };
  ratePeriods?: AllotmentRatePeriod[];
  rateSheetDataUrl?: string; // Base64 data URL for uploaded rate sheet
  rateSheetName?: string; // Original filename of rate sheet
  rateSheetUploadedAt?: string; // Upload timestamp
}

export interface RoomLine {
  id: string;
  roomType: string; // Single, Double, Triple, Quad, Quint
  qty: number;
  nightlyRates: number | { [date: string]: number }; // Selling rate(s) per night
  buyRate: number | { [date: string]: number };      // Buying rate(s) per night
  mealPlan: string;
  hasSeparateMealRate: boolean;
  mealRate: number; // sell meal rate per person per night
  mealBuyRate?: number; // buy meal rate per person per night
  hasExtraBed?: boolean;
  extraBedRate?: number; // sell extra bed rate
  extraBedBuyRate?: number; // buy extra bed rate
  pax: number;      // auto calculated based on roomType
  view?: string;
  hasViewSupplement?: boolean;
  viewSupplementRate?: number; // sell view supplement per room per night
  viewSupplementBuyRate?: number; // buy view supplement per room per night
  hasExtraMeal1?: boolean;
  extraMeal1Label?: string; // e.g. "Dinner" or "Lunch"
  extraMeal1Rate?: number; // sell rate per pax per night
  extraMeal1BuyRate?: number; // buy rate per pax per night
  hasExtraMeal2?: boolean;
  extraMeal2Label?: string; // e.g. "Dinner" or "Lunch"
  extraMeal2Rate?: number; // sell rate per pax per night
  extraMeal2BuyRate?: number; // buy rate per pax per night
}

export type ReservationStatus = 'Tentative' | 'Confirmed' | 'Cancelled';

export interface Reservation {
  id: number; // Auto-incrementing RSV #
  checkIn: string;
  checkOut: string;
  nights: number;
  clientId: string; // Client agent ID
  hotelId: string;
  guestName: string;
  guestNationality: string;
  clientOptionDate?: string;
  termsAndConditions?: string;
  supplierId: string;
  supplierVoucher?: string;
  supplierOptionDate?: string;
  rooms: RoomLine[];
  status: ReservationStatus;
  agreementNo?: string;
  agreementConfirmed?: boolean;
  agreementStatus?: 'Approved' | 'Pending' | 'Declined';
  hotelConfirmationNo?: string;
  bankAccountId?: string;
  amountPaidByClient: number; // Paid on this specific booking
  amountPaidToSupplier: number; // Paid to supplier on this specific booking
  createdBy: string;
  createdAt: string;
  cancellationFee?: number;
  cancellationReason?: string;
  clientCreditDisposition?: 'Refunded' | 'Kept as Credit' | 'N/A';
  supplierCreditDisposition?: 'Refunded' | 'Kept as Credit' | 'N/A';
  clientCreditNote?: string;
  supplierCreditNote?: string;
  roomingList?: string;
  allotmentId?: string; // Linked allotment ID if booked through allotment
  nonRefundable?: boolean; // Non-refundable booking flag
  amendmentHistory?: AmendmentEntry[]; // Track changes to this reservation
}

export interface Account {
  id: string;
  name: string;
  accountHolderName?: string;
  accountNumber?: string;
  type: 'Cash' | 'Bank';
  balance: number;
  code?: string;
  currency?: string;
}

export interface Transaction {
  id: string;
  docNo: string; // Counter-based
  date: string;
  type: 'ClientPayment' | 'SupplierPayment' | 'ClientRefund' | 'SupplierRefund' | 'Transfer' | 'CreditApplied' | 'RefundProcessed';
  amount: number;
  fromAccountId?: string;
  toAccountId?: string;
  reservationId?: string; // Optional linked reservation
  agentId?: string;       // Client or supplier agent ID
  description: string;
  attachmentDataUrl?: string;
  paymentMethod: 'Cash' | 'Bank Transfer';
  voucherNo: string;      // Receipt voucher code
  createdBy: string;
  originalCurrency?: 'SAR' | 'EGP';
  originalAmount?: number;
  exchangeRate?: number;
}

export interface User {
  id: string;
  username: string;
  name: string;
  jobTitle?: string;
  role: 'Admin' | 'Sales' | 'Finance' | 'Reservationist' | 'ReservationsManager';
  email: string;
  password?: string;
  mustChangePassword?: boolean; // Force password change on next login
}

export interface FollowUp {
  id: string;
  clientId: string;
  date: string;
  topic: string;
  notes: string;
  status: 'Pending' | 'Completed' | 'Closed';
  createdBy: string;
  activityLog?: ActivityLogEntry[];
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  detail: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
}

export interface ExternalTransferPart {
  amount: number;
  fxRate?: number;
  attachmentDataUrl?: string; // Optional image/pdf trace
}

export interface ExternalTransfer {
  id: string;
  date: string;
  bookingRef: string;
  clientName: string;
  supplierName: string;
  amountSAR: number;
  parts: ExternalTransferPart[];
  currency?: string;
  totalAmountPaidEGP?: number; 
  amountRemainingEGP?: number; 
  status: 'Pending' | 'Done';
}

// ==================== General Data ====================

export interface SalesPerson {
  id: string;
  name: string;
  phone: string;
  email: string;
  commission: number; // Commission percentage
  active: boolean;
}

export interface CancellationReason {
  id: string;
  reason: string;
  active: boolean;
}

export interface TermsAndConditions {
  id: string;
  title: string;
  content: string;
  active: boolean;
}

// ==================== Other Services ====================

export type ServiceType = 'OutboundHotel' | 'Flight' | 'Visa' | 'Transportation';

export interface OtherService {
  id: string;
  serviceType: ServiceType;
  clientId: string;
  description: string;
  quantity: number;
  sellPrice: number;
  buyPrice: number;
  taxRate: number;
  date: string;
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';
  invoiceNo?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  // Type-specific fields stored as key-value
  details?: Record<string, string>;
}

// ==================== Payment Gateways ====================

export interface PaymentGateway {
  id: string;
  name: string;
  type: 'Bank' | 'Visa' | 'Mada' | 'ApplePay';
  merchantId?: string;
  apiKey?: string;
  secretKey?: string;
  webhookUrl?: string;
  active: boolean;
}

export interface PayByLink {
  id: string;
  gatewayId: string;
  amount: number;
  currency: string;
  description: string;
  clientEmail?: string;
  clientPhone?: string;
  reservationId?: string;
  status: 'Draft' | 'Sent' | 'Paid' | 'Expired' | 'Cancelled';
  expiresAt: string;
  createdAt: string;
  createdBy: string;
}

// ==================== Edit Approval ====================

export interface EditApprovalRequest {
  id: string;
  reservationId: number;
  requestedBy: string;
  requestedAt: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  changes: { field: string; oldValue: string; newValue: string }[];
  originalSnapshot: Partial<Reservation>;
  newSnapshot: Partial<Reservation>;
}

// ==================== Tax Settings ====================

export interface TaxSettings {
  id: string;
  name: string;
  rate: number;
  appliesTo: ServiceType[];
  active: boolean;
}
