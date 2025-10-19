import axios from 'axios';
import { IOtpProvider } from './otpProvider';

export class TextBeeAdapter implements IOtpProvider {
  private apiKey: string;
  private deviceId: string;
  private baseUrl: string;

  constructor(apiKey: string, deviceId: string, baseUrl = 'https://api.textbee.dev/api/v1') {
    this.apiKey = apiKey;
    this.deviceId = deviceId;
    this.baseUrl = baseUrl;
  }

  async sendOtp(recipient: string, message: string): Promise<void> {
    if (!this.apiKey || !this.deviceId) {
      // In test/dev mode, just log
      // eslint-disable-next-line no-console
      console.log(`[TextBeeAdapter] mock send to ${recipient}: ${message}`);
      return;
    }

    const url = `${this.baseUrl}/gateway/devices/${this.deviceId}/send-sms`;
    await axios.post(
      url,
      { recipients: [recipient], message },
      { headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey } }
    );
  }
}
