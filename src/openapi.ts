import { OpenAPIV3 } from 'openapi-types';

export const openApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'TextBee OTP Service',
    version: '1.0.0',
    description: 'Phone verification microservice using TextBee SMS gateway',
  },
  servers: [{ url: 'http://localhost:3000' }],
  paths: {
    '/otp/send': {
      post: {
        summary: 'Send OTP to phone',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  phone: { type: 'string', example: '+1234567890' },
                },
                required: ['phone'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'OTP sent',
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'sent' } } } } },
          },
          '429': {
            description: 'Rate limited',
            content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string', example: 'rate_limited' } } } } },
          },
          '400': {
            description: 'Invalid input',
            content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' }, details: { type: 'object' } } } } },
          },
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
                  phone: { type: 'string', example: '+1234567890' },
                  code: { type: 'string', example: '123456' },
                },
                required: ['phone', 'code'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'OTP verified',
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'verified' } } } } },
          },
          '400': {
            description: 'Invalid code or input',
            content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string', example: 'invalid_code' } } } } },
          },
        },
      },
    },
  },
};
