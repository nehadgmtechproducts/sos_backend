import { env, isProd } from '../config/env.js';
import { maskPhone } from '../utils/phone.js';

export interface SmsProvider {
  send(to: string, body: string): Promise<void>;
}

/** Dev provider: prints the OTP to your terminal instead of spending SMS credits. */
const consoleProvider: SmsProvider = {
  async send(to, body) {
    console.log(`\n  [SMS -> ${maskPhone(to)}] ${body}\n`);
  },
};

/**
 * Swap in a real provider here (Twilio, MSG91, Gupshup...) when you go live.
 * Keep the SmsProvider interface so nothing else in the codebase has to change:
 *
 *   const twilioProvider: SmsProvider = {
 *     async send(to, body) { await client.messages.create({ to, from: env.TWILIO_FROM, body }); }
 *   };
 */
export const sms: SmsProvider = consoleProvider;

export function otpMessage(code: string): string {
  const mins = Math.round(env.OTP_TTL_SECONDS / 60);
  return `${code} is your verification code. It expires in ${mins} minute${mins === 1 ? '' : 's'}. Do not share it with anyone.`;
}

export const exposeOtpInResponse = !isProd;
