const express = require('express');
const cors = require('cors');

// Puppeteer com Stealth Plugin
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rota principal para scraping
app.post('/api/scrape', async (req, res) => {
    let browser = null;
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        console.log(`Scraping URL: ${url}`);

        // Scrape usando Puppeteer
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();

        // Otimização: Bloquear recursos desnecessários (imagens, fontes, css)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Configurações para parecer mais humano
        await page.setViewport({ width: 1280, height: 800 });

        // Tentar navegar (domcontentloaded é mais rápido que networkidle2)
        // Timeout reduzido
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Pequena espera manual para garantir scripts mas não excessiva
        await new Promise(r => setTimeout(r, 2000));

        // Obter o conteúdo HTML da página renderizada
        const html = await page.content();

        // Lógica de extração fornecida pelo usuário
        let total_results = 0;

        // 2. REGEX ROBUSTA REVISADA
        const regexRobusta = /"search_results_connection":\s*\{.*?\"count\":(\d+)/s;
        let match = html.match(regexRobusta);

        if (match && match.length > 1) {
            total_results = parseInt(match[1]);
        } else {
            // 3. FALLBACK AVANÇADO
            const regexCollationCount = /"collation_count":(\d+)/;
            match = html.match(regexCollationCount);

            if (match && match.length > 1) {
                total_results = parseInt(match[1]);
            }
        }

        const result = {
            "bb-ads": {
                total_search_results: total_results
            }
        };

        await browser.close();
        return res.json(result);

    } catch (error) {
        console.error('Error scraping:', error);
        if (browser) {
            try {
                await browser.close();
            } catch (e) { console.error("Error closing browser", e); }
        }

        return res.status(500).json({
            "bb-ads": {
                total_search_results: 0,
                error: error.message
            }
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
