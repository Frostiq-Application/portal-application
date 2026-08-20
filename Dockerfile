# ---- build: compile the Vite SPA ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Baked into the JS bundle at build time (Vite only exposes VITE_-prefixed vars).
# Optionally override by setting VITE_API_BASE_URL as a Railway build variable;
# unset, the build falls back to .env.production.
#
# The variable is exported only when it is non-empty, and that `if` is the whole
# point. `ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}` with the ARG unpassed sets
# it to the EMPTY STRING, and Vite's loadEnv gives process.env priority over
# .env files — so the empty value wins and the bundle ships with no API host at
# all. That failure is silent at build time and only shows up as every request
# in the browser going to the wrong place.
ARG VITE_API_BASE_URL
RUN if [ -n "$VITE_API_BASE_URL" ]; then \
      echo "Using VITE_API_BASE_URL from build arg: $VITE_API_BASE_URL"; \
      VITE_API_BASE_URL="$VITE_API_BASE_URL" npm run build:production; \
    else \
      echo "No VITE_API_BASE_URL build arg; using .env.production"; \
      npm run build:production; \
    fi

# ---- runner: serve the static build with nginx ----
FROM nginx:1.27-alpine AS runner
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Railway sets $PORT at runtime; the official nginx image auto-renders
# templates/*.template -> conf.d/*.conf via envsubst on startup.
ENV PORT=8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
