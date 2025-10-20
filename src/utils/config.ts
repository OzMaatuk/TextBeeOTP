export const config = {
    get port() {
        return Number(process.env.PORT || 3000);
    },
    get nodeEnv() {
        return process.env.NODE_ENV || 'development';
    },

    get otpTtlSeconds() {
        return Number(process.env.OTP_TTL_SECONDS || 300);
    },
    get otpLength() {
        return Number(process.env.OTP_LENGTH || 6);
    },

    get rateLimitWindowMs() {
        return Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
    },
    get rateLimitMax() {
        return Number(process.env.RATE_LIMIT_MAX || 5);
    },

    get redisUrl() {
        return process.env.REDIS_URL;
    },

    get textbeeApiKey() {
        return process.env.TEXTBEE_API_KEY || '';
    },
    get textbeeDeviceId() {
        return process.env.TEXTBEE_DEVICE_ID || '';
    },

    get resendApiKey() {
        return process.env.RESEND_API_KEY;
    },
    get resendFromEmail() {
        return process.env.RESEND_FROM_EMAIL || 'noreply@example.com';
    },
};


