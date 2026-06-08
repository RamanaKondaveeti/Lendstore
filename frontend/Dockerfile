FROM node:20-alpine AS build

WORKDIR /app

ARG EXPO_PUBLIC_API_URL=http://localhost:5000
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL

COPY frontend/package*.json ./
RUN npm install

COPY frontend .
RUN npx expo export --platform web

FROM nginx:1.27-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
