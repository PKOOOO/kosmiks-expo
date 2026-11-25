/**
 * Known plain-text error messages from the backend (always English), mapped
 * to translation keys so the provider and admin screens show them in the app
 * language. Unknown messages are shown as they are.
 */
import { tr, type TKey } from './index';

const MESSAGES: Record<string, TKey> = {
  "Booking not found": 'server.s0',
  "Could not open Stripe. Please try again.": 'server.s1',
  "Could not reach Stripe": 'server.s2',
  "Could not start Stripe setup. Please try again.": 'server.s3',
  "File is too large (max 10 MB)": 'server.s4',
  "Finish setting up payouts first.": 'server.s5',
  "Invalid date of birth format": 'server.s6',
  "Invalid qualification documents": 'server.s7',
  "Missing required fields": 'server.s8',
  "Must be 18 or older to register": 'server.s9',
  "No file provided": 'server.s10',
  "No saloon found": 'server.s11',
  "Only upcoming bookings can be cancelled.": 'server.s12',
  "Payout was changed by someone else \u2014 reload": 'server.s13',
  "Rejection reason required": 'server.s14',
  "This booking is already included in a payout. Contact Kosmiks support to change it.": 'server.s15',
  "This booking was just changed. Refresh and try again.": 'server.s16',
  "This booking can't be refunded automatically. Contact Kosmiks support to cancel it.": 'server.s17',
  "The refund didn't go through, so the booking was not cancelled. Please try again.": 'server.s18',
  "Unsupported file type": 'server.s19',
  "Withdrawal failed. Please try again.": 'server.s20',
  "You can mark a booking once its start time has passed.": 'server.s21',
  "Phase 1 must be approved before submitting Phase 2": 'server.s22',
  "Phase 2 must be approved before completing salon setup": 'server.s23',
  "Cannot delete category with existing services": 'server.s24',
  "Cannot delete parent service with existing sub-services": 'server.s25',
  "Cannot delete service: it is referenced by other records": 'server.s26',
  "Cannot delete service that has existing bookings": 'server.s27',
  "Category with this name already exists for this saloon": 'server.s28',
  "Enter a valid phone number": 'server.s29',
  "Global category with this name already exists": 'server.s30',
  "Images are required": 'server.s31',
  "Name is required": 'server.s32',
  "Parent service must be in the same category": 'server.s33',
  "Parent service with this name already exists in this category": 'server.s34',
  "Service already exists for this saloon": 'server.s35',
  "Sub-service with this name already exists under this parent service": 'server.s36',
};

export function translateServerMessage(text: string): string {
  const key = MESSAGES[text.trim().replace(/\.$/, '')] ?? MESSAGES[text.trim()];
  return key ? tr(key) : text;
}
