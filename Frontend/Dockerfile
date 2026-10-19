# ==============================================================================
# NutriTrack AI — Frontend Multi-Stage Production Dockerfile
# Builds with Vite/Node 20; Serves static SPA bundle with Nginx Alpine
# ==============================================================================

# Stage 1: Build production bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Injected at build time to burn target API URL into the client bundle
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve with lightweight Nginx
FROM nginx:alpine

# Remove default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy built distribution assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration with SPA fallback routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
