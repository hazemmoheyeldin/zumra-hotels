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
