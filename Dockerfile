# syntax=docker/dockerfile:1

# Base stage for shared settings
FROM node:20-alpine AS base
RUN npm install -g npm@latest
WORKDIR /workspace

# Development stage
FROM base AS development
ENV NODE_ENV=development
# Copy only package files first to cache dependencies
COPY package*.json ./
COPY tsconfig.json ./
# Install all dependencies
RUN npm install
# Copy source code
COPY . .
# Development server command
CMD ["npm", "run", "dev"]

# Builder stage
FROM base AS builder
ENV NODE_ENV=production
# Copy only package files first to cache dependencies
COPY package*.json ./
COPY tsconfig.json ./
# Install all dependencies for building
RUN npm install
# Copy source code
COPY . .
# Build the application
RUN npm run build

# Production stage
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
# Copy package files
COPY package*.json ./
# Install only production dependencies
RUN npm install --omit=dev
# Copy built files from builder
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]