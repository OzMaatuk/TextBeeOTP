# syntax=docker/dockerfile:1

# Base image
ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-alpine AS base
RUN npm install -g npm@latest
RUN npm install -g typescript ts-node
RUN apk add --no-cache git
WORKDIR /workspace

# Install dev dependencies in development stage
FROM base AS development
ENV NODE_ENV=development
# Copy only package files first (caching)
COPY package*.json tsconfig.json ./
# Install dependencies
RUN npm install
# Copy source code
COPY . .
# Default dev command
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS builder
ENV NODE_ENV=production
COPY package*.json tsconfig.json ./
RUN npm install
COPY . .
RUN npm run build

# Production runtime
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /workspace/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
