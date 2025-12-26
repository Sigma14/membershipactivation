
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build



FROM nginx:1.25-alpine


RUN rm /etc/nginx/conf.d/default.conf


COPY nginx.conf /etc/nginx/conf.d/default.conf


COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8083
CMD ["nginx", "-g", "daemon off;"]
