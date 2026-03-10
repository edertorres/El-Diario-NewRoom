# Dockerfile para IDML Injector Pro - Modo Desarrollo
FROM node:20-alpine

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache \
    git \
    curl

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar el resto del código
COPY . .

# Exponer puerto de desarrollo
EXPOSE 5173

# Comando por defecto: servidor de desarrollo
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
