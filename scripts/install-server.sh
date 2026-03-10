#!/bin/bash

# Script de instalación para servidor CentOS
# Ejecutar con: bash scripts/install-server.sh

set -e

echo "=========================================="
echo "Instalación de IDML Injector Pro - Desarrollo"
echo "=========================================="

# Detectar versión de CentOS
if [ -f /etc/redhat-release ]; then
    CENTOS_VERSION=$(cat /etc/redhat-release | grep -oE '[0-9]+' | head -1)
    echo "CentOS versión detectada: $CENTOS_VERSION"
else
    echo "Error: Este script es para CentOS"
    exit 1
fi

# Función para instalar paquetes según versión
install_package() {
    if [ "$CENTOS_VERSION" -ge 8 ]; then
        sudo dnf install -y "$1"
    else
        sudo yum install -y "$1"
    fi
}

# Paso 1: Actualizar sistema
echo ""
echo "1. Actualizando sistema..."
if [ "$CENTOS_VERSION" -ge 8 ]; then
    sudo dnf update -y
else
    sudo yum update -y
fi

# Paso 2: Instalar herramientas básicas
echo ""
echo "2. Instalando herramientas básicas..."
install_package git
install_package curl
install_package wget

# Paso 3: Instalar Node.js LTS
echo ""
echo "3. Instalando Node.js LTS..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        echo "Node.js ya está instalado: $(node --version)"
    else
        echo "Node.js versión antigua detectada. Actualizando..."
        curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
        install_package nodejs
    fi
else
    echo "Instalando Node.js desde NodeSource..."
    curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
    install_package nodejs
fi

# Verificar instalación
echo ""
echo "Verificando instalación..."
node --version
npm --version

# Paso 4: Configurar firewall
echo ""
echo "4. Configurando firewall..."
if systemctl is-active --quiet firewalld; then
    echo "Firewalld está activo. Abriendo puerto 5173..."
    sudo firewall-cmd --permanent --add-port=5173/tcp
    sudo firewall-cmd --reload
    echo "Puerto 5173 abierto en firewalld"
elif command -v iptables &> /dev/null; then
    echo "Usando iptables. Abriendo puerto 5173..."
    sudo iptables -A INPUT -p tcp --dport 5173 -j ACCEPT
    echo "Puerto 5173 abierto en iptables"
    echo "NOTA: Guarda las reglas de iptables con: sudo service iptables save"
else
    echo "ADVERTENCIA: No se detectó firewall. Asegúrate de abrir el puerto 5173 manualmente."
fi

echo ""
echo "=========================================="
echo "Instalación completada!"
echo "=========================================="
echo ""
echo "Próximos pasos:"
echo "1. Transferir el código al servidor"
echo "2. Ejecutar: cd /ruta/idml-injector-pro && npm install"
echo "3. Configurar archivo .env (ver .env.example)"
echo "4. Ejecutar: npm run dev"
echo ""
