import axios from 'axios';
import { IOtpProvider } from './otpProvider';
import pino from 'pino';

export class TextBeeAdapter implements IOtpProvider {
  private apiKey: string;
  private deviceId: string;
  private baseUrl: string;
  private logger?: pino.Logger;

  constructor(apiKey: string, deviceId: string, baseUrl = 'https://api.textbee.dev/api/v1', logger?: pino.Logger) {
    this.apiKey = apiKey;
    this.deviceId = deviceId;
    this.baseUrl = baseUrl;
    this.logger = logger;
  }

  async sendOtp(recipient: string, message: string): Promise<void> {
    if (!this.apiKey || !this.deviceId) {
      // In test/dev mode, just log
      if (this.logger) {
        this.logger.debug({ recipient, message }, '[TextBeeAdapter] mock send');
      }
      return;
    }

    const url = `${this.baseUrl}/gateway/devices/${this.deviceId}/send-sms`;
    try {
      await axios.post(
        url,
        { recipients: [recipient], message },
        {
          headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey },
          timeout: 10000, // 10 second timeout for external API calls
        }
      );
    } catch (error) {
      if (this.logger) {
        this.logger.error({ err: error, recipient }, '[TextBeeAdapter] Failed to send SMS');
      }
      throw new Error(`SMS sending failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
