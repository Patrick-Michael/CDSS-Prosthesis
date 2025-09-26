FROM node:20-slim

WORKDIR /web

# Install dependencies first (better cache)
COPY package*.json ./
RUN npm ci

# Copy frontend code (Compose also mounts it for live dev)
COPY . .

EXPOSE 5174

# Run Vite on 0.0.0.0 so Codespaces/Compose can forward it
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5174"]
