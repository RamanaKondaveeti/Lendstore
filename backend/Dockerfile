FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src
COPY ../.env .env 2>/dev/null || true

EXPOSE 5000

CMD ["npm", "start"]
