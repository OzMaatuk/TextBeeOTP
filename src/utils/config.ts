function validateNumber(value: number, name: string, min?: number, max?: number): number {
    if (isNaN(value)) {
        throw new Error(`Invalid ${name}: ${process.env[name]} is not a valid number`);
    }
    if (min !== undefined && value < min) {
        throw new Error(`Invalid ${name}: ${value} is less than minimum ${min}`);
    }
    if (max !== undefined && value > max) {
        throw new Error(`Invalid ${name}: ${value} is greater than maximum ${max}`);
    }
    return value;
}

export const config = {
    get port() {
        const val = Number(process.env.PORT || 3008);
        return validateNumber(val, 'PORT', 1, 65535);
    },
    get nodeEnv() {
        return process.env.NODE_ENV || 'development';
    },

    get otpTtlSeconds() {
        const val = Number(process.env.OTP_TTL_SECONDS || 300);
        return validateNumber(val, 'OTP_TTL_SECONDS', 60, 3600);
    },
    get otpLength() {
        const val = Number(process.env.OTP_LENGTH || 6);
        return validateNumber(val, 'OTP_LENGTH', 4, 10);
    },

    get rateLimitWindowMs() {
        const val = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
        return validateNumber(val, 'RATE_LIMIT_WINDOW_MS', 1000);
    },
    get rateLimitMax() {
        const val = Number(process.env.RATE_LIMIT_MAX || 5);
        return validateNumber(val, 'RATE_LIMIT_MAX', 1);
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
        const val = Number(process.env.SMTP_PORT || 465);
        return validateNumber(val, 'SMTP_PORT', 1, 65535);
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
