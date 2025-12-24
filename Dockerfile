FROM node:18-slim

# Instalar dependências necessárias para o Puppeteer (Chrome/Chromium)
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Diretório de trabalho
WORKDIR /usr/src/app

# Copiar arquivos de dependência
COPY package*.json ./

# Instalar dependências do projeto
# O Puppeteer já baixa uma versão do Chrome, mas vamos dizer para ele usar a instalada ou as libs do sistema se necessário.
# Para produção, ignoramos o script de download do puppeteer para economizar espaço e usamos o google-chrome-stable se quisermos,
# mas o puppeteer-extra geralmente gosta do binário empacotado.
# Vamos deixar o install normal para garantir compatibilidade.
RUN npm install

# Copiar o restante do código
COPY . .

# Variável de ambiente para o Puppeteer não falhar no Docker
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Porta exposta
EXPOSE 3000

# Comando de inicialização
CMD [ "node", "index.js" ]
