export type OtpChannel = 'sms' | 'email';

export interface IOtpProvider {
  sendOtp(recipient: string, message: string): Promise<void>;
}
