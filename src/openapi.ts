import { OpenAPIV3 } from 'openapi-types';

export const openApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'OTP Service',
    version: '1.0.0',
    description: 'Phone and Email verification microservice',
  },
  servers: [{ url: 'http://localhost:3008' }],
  paths: {
    '/otp/send': {
      post: {
        summary: 'Send OTP to a recipient via a specified channel',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  recipient: {
                    type: 'string',
                    description: 'Phone number or email address',
                    example: '+1234567890',
                  },
                  channel: { type: 'string', enum: ['sms', 'email'], example: 'sms' },
                },
                required: ['recipient', 'channel'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'OTP sent' },
          '429': { description: 'Rate limited' },
          '400': { description: 'Invalid input' },
        },
      },
    },
    '/otp/verify': {
      post: {
        summary: 'Verify OTP code',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  recipient: {
                    type: 'string',
                    description: 'Phone number or email address',
                    example: '+1234567890',
                  },
                  code: { type: 'string', example: '123456' },
                },
                required: ['recipient', 'code'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'OTP verified' },
          '400': { description: 'Invalid code or input' },
        },
      },
    },
  },
};
