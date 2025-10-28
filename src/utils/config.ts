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

    // Email configuration (Zoho SMTP)
    get emailFrom() {
        return process.env.EMAIL_FROM || 'noreply@example.com';
    },
    // SMTP (Zoho defaults)
    get smtpHost() {
        return process.env.SMTP_HOST || 'smtp.zoho.com';
    },
    get smtpPort() {
        return Number(process.env.SMTP_PORT || 465);
    },
    get smtpSecure() {
        const raw = process.env.SMTP_SECURE;
        if (raw === undefined) return true; // default secure for port 465
        return /^(1|true|yes)$/i.test(raw);
    },
    get smtpUser() {
        return process.env.SMTP_USER || '';
    },
    get smtpPass() {
        return process.env.SMTP_PASS || '';
    },
};
