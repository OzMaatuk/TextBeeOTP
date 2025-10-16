export interface ISmsProvider {
  sendSms(recipient: string, message: string): Promise<void>;
}
