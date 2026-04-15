import axios from 'axios';
import pino from 'pino';
import { TextBeeAdapter } from '../src/providers/textbeeAdapter';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TextBeeAdapter', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('throws a provider error when the upstream sms request fails', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('gateway down'));

    const adapter = new TextBeeAdapter('api-key', 'device-id', 'https://example.test', pino());

    await expect(adapter.sendOtp('+1234567890', 'Your verification code is 123456')).rejects.toThrow(
      'SMS sending failed: gateway down'
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://example.test/gateway/devices/device-id/send-sms',
      { recipients: ['+1234567890'], message: 'Your verification code is 123456' },
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'api-key' }),
        timeout: 10000,
      })
    );
  });
});
