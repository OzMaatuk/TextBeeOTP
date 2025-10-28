declare module 'nodemailer' {
    interface SentMessageInfo {
        messageId: string;
        [key: string]: any;
    }

    interface TransportOptions {
        host: string;
        port: number;
        secure: boolean;
        auth: {
            user: string;
            pass: string;
        };
    }

    export interface Transporter {
        sendMail(mailOptions: {
            from: string;
            to: string;
            subject: string;
            html: string;
            text: string;
        }): Promise<SentMessageInfo>;
    }

    export default function createTransport(options: TransportOptions): Transporter;
}


