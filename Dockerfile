# ---- build: compile the Vite SPA ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Baked into the JS bundle at build time (Vite only exposes VITE_-prefixed vars).
# Override by setting VITE_API_BASE_URL as a Railway build variable; otherwise
# falls back to whatever .env.production already has.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build:production

# ---- runner: serve the static build with nginx ----
FROM nginx:1.27-alpine AS runner
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Railway sets $PORT at runtime; the official nginx image auto-renders
# templates/*.template -> conf.d/*.conf via envsubst on startup.
ENV PORT=8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
