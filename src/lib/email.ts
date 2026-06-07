/**
 * EmailJS Integration for Zumra Hotels RMS
 * Handles invitation emails and password reset notifications
 */

import emailjs from '@emailjs/browser';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

export const isEmailConfigured = !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);

/**
 * Send an invitation email to a new user with their temporary credentials.
 * The EmailJS template should have variables:
 *   {{to_email}}, {{user_name}}, {{username}}, {{temp_password}}, {{login_url}}
 */
/**
 * Send a daily summary email to the admin.
 */
export async function sendDailySummaryEmail(
  adminEmail: string,
  summaryHtml: string,
  summarySubject: string
): Promise<{ success: boolean; error?: string }> {
  if (!isEmailConfigured) {
    return { success: false, error: 'Email service not configured.' };
  }
  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: adminEmail,
        user_name: 'Admin',
        username: '',
        temp_password: '',
        login_url: window.location.origin,
        logo_url: `${window.location.origin}/zumra-logo.png`,
        message: summaryHtml,
        subject: summarySubject,
      },
      { publicKey: PUBLIC_KEY }
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.text || err?.message || 'Failed to send summary.' };
  }
}

export async function sendPasswordResetEmail(
  toEmail: string,
  userName: string,
  tempPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!isEmailConfigured) {
    return { success: false, error: 'Email service not configured.' };
  }
  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: toEmail,
        user_name: userName,
        username: '',
        temp_password: tempPassword,
        login_url: window.location.origin,
        logo_url: `${window.location.origin}/zumra-logo.png`,
        message: `Your password has been reset. Your temporary password is: <strong>${tempPassword}</strong><br/><br/>You will be required to change it on next login.`,
        subject: 'Zumra Hotels - Password Reset',
      },
      { publicKey: PUBLIC_KEY }
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.text || err?.message || 'Failed to send reset email.' };
  }
}

export async function sendBookingConfirmation(
  toEmail: string,
  guestName: string,
  reservationId: number,
  hotelName: string,
  checkIn: string,
  checkOut: string,
  totalAmount: number
): Promise<{ success: boolean; error?: string }> {
  if (!isEmailConfigured) return { success: false, error: 'Email service not configured.' };
  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_email: toEmail,
      user_name: guestName,
      username: '',
      temp_password: '',
      login_url: window.location.origin,
      logo_url: `${window.location.origin}/zumra-logo.png`,
      message: `<h3>Booking Confirmation - RSV-${reservationId}</h3><p>Dear ${guestName},</p><p>Your booking has been confirmed:</p><ul><li><strong>Hotel:</strong> ${hotelName}</li><li><strong>Check-in:</strong> ${checkIn}</li><li><strong>Check-out:</strong> ${checkOut}</li><li><strong>Total:</strong> ${totalAmount.toLocaleString()} SAR</li></ul><p>Thank you for choosing Zumra Hotels.</p>`,
      subject: `Zumra Hotels - Booking Confirmation RSV-${reservationId}`,
    }, { publicKey: PUBLIC_KEY });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.text || err?.message || 'Failed to send.' };
  }
}

export async function sendPaymentReceipt(
  toEmail: string,
  clientName: string,
  voucherNo: string,
  amount: number,
  date: string
): Promise<{ success: boolean; error?: string }> {
  if (!isEmailConfigured) return { success: false, error: 'Email service not configured.' };
  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_email: toEmail,
      user_name: clientName,
      username: '',
      temp_password: '',
      login_url: window.location.origin,
      logo_url: `${window.location.origin}/zumra-logo.png`,
      message: `<h3>Payment Receipt - ${voucherNo}</h3><p>Dear ${clientName},</p><p>We confirm receipt of your payment:</p><ul><li><strong>Voucher:</strong> ${voucherNo}</li><li><strong>Amount:</strong> ${amount.toLocaleString()} SAR</li><li><strong>Date:</strong> ${date}</li></ul><p>Thank you.</p>`,
      subject: `Zumra Hotels - Payment Receipt ${voucherNo}`,
    }, { publicKey: PUBLIC_KEY });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.text || err?.message || 'Failed to send.' };
  }
}

export async function sendPaymentReminder(
  toEmail: string,
  clientName: string,
  reservationId: number,
  guestName: string,
  amountDue: number,
  checkIn: string
): Promise<{ success: boolean; error?: string }> {
  if (!isEmailConfigured) return { success: false, error: 'Email service not configured.' };
  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      to_email: toEmail,
      user_name: clientName,
      username: '',
      temp_password: '',
      login_url: window.location.origin,
      logo_url: `${window.location.origin}/zumra-logo.png`,
      message: `<h3>Payment Reminder - RSV-${reservationId}</h3><p>Dear ${clientName},</p><p>This is a friendly reminder that payment is due for:</p><ul><li><strong>Guest:</strong> ${guestName}</li><li><strong>Reservation:</strong> RSV-${reservationId}</li><li><strong>Amount Due:</strong> ${amountDue.toLocaleString()} SAR</li><li><strong>Check-in:</strong> ${checkIn}</li></ul><p>Please arrange payment at your earliest convenience.</p>`,
      subject: `Zumra Hotels - Payment Reminder RSV-${reservationId}`,
    }, { publicKey: PUBLIC_KEY });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.text || err?.message || 'Failed to send.' };
  }
}

export async function sendInvitationEmail(
  toEmail: string,
  userName: string,
  username: string,
  tempPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!isEmailConfigured) {
    return {
      success: false,
      error: 'Email service not configured. Please set VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY in your environment.',
    };
  }

  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: toEmail,
        user_name: userName,
        username,
        temp_password: tempPassword,
        login_url: window.location.origin,
        logo_url: `${window.location.origin}/zumra-logo.png`,
      },
      { publicKey: PUBLIC_KEY }
    );
    return { success: true };
  } catch (err: any) {
    console.error('[EmailJS] Failed to send invitation:', err);
    return {
      success: false,
      error: err?.text || err?.message || 'Failed to send email. Please try again.',
    };
  }
}

export async function sendSupplierRateConfirmation(
  supplierEmail: string,
  supplierName: string,
  rsvId: number,
  guestName: string,
  hotelName: string,
  checkIn: string,
  checkOut: string,
  nights: number,
  totalBuy: number,
  supplierVoucher?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isEmailConfigured) {
    return { success: false, error: 'Email service not configured' };
  }
  try {
    await (emailjs as any).send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: supplierEmail,
        to_name: supplierName,
        subject: `Rate Confirmation Request - RSV-${rsvId} | ${guestName} | ${checkIn}`,
        message: `Dear ${supplierName},\n\nPlease confirm the following booking:\n\n` +
          `RSV: ${rsvId}\n` +
          `Guest: ${guestName}\n` +
          `Hotel: ${hotelName}\n` +
          `Check-in: ${checkIn}\n` +
          `Check-out: ${checkOut}\n` +
          `Nights: ${nights}\n` +
          `Net Rate: ${totalBuy.toLocaleString()} SAR\n` +
          (supplierVoucher ? `Your Ref: ${supplierVoucher}\n` : '') +
          `\nPlease confirm at your earliest convenience.\n\nZumra Hotels`,
        logo_url: `${window.location.origin}/zumra-logo.png`,
      },
      { publicKey: PUBLIC_KEY }
    );
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.text || err?.message || 'Failed to send' };
  }
}
