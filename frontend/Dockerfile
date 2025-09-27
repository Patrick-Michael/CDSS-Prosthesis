FROM node:20-slim

WORKDIR /web

COPY package*.json ./
RUN npm ci

COPY . .

# Build frontend once
RUN npm run build

EXPOSE 5173

# Use Vite's built-in preview server
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
