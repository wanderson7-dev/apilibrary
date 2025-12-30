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

// Variável global para instância do navegador
let browser = null;

// Função para iniciar o navegador (Singleton)
async function initBrowser() {
    if (browser) {
        if (browser.isConnected()) return browser;
        console.log('Navegador desconectado/fechado. Reiniciando...');
    }

    console.log('Iniciando navegador Puppeteer...');
    try {
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

        browser.on('disconnected', () => {
            console.log('Navegador desconectado. Será reiniciado na próxima requisição.');
            browser = null;
        });

        return browser;
    } catch (e) {
        console.error("Falha ao iniciar navegador:", e);
        throw e;
    }
}

// Inicia o navegador assim que o servidor subir
initBrowser();

// Rota principal para scraping
app.post('/api/scrape', async (req, res) => {
    let page = null;
    try {
        const url = req.body.bb_ads;

        if (!url) {
            return res.status(400).json({ error: 'Parameter "bb_ads" is required' });
        }

        console.log(`Scraping URL: ${url}`);

        const browserInstance = await initBrowser();
        page = await browserInstance.newPage();

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setViewport({ width: 1280, height: 800 });

        // Navega
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        } catch (gotoErr) {
            console.log('Debug: Warning navigating:', gotoErr.message);
            // Se for erro de contexto, seguimos para o loop tentar pegar o conteúdo msm assim
            if (!gotoErr.message.includes('Execution context was destroyed') && !gotoErr.message.includes('Navigating frame was detached')) {
                throw gotoErr;
            }
        }

        let total_results = 0;
        let attempts = 0;
        const maxAttempts = 20; // ~4s

        while (attempts < maxAttempts) {
            try {
                const html = await page.content();

                // Tenta regex original
                const regexRobusta = /"search_results_connection":\s*\{.*?\"count\":(\d+)/s;
                let match = html.match(regexRobusta);

                if (match && match.length > 1) {
                    total_results = parseInt(match[1]);
                    if (total_results > 0) {
                        console.log(`Debug: Encontrado via regexRobusta: ${total_results}`);
                        break;
                    }
                }

                // Tenta fallback
                const regexCollationCount = /"collation_count":(\d+)/;
                match = html.match(regexCollationCount);

                if (match && match.length > 1) {
                    total_results = parseInt(match[1]);
                    if (total_results > 0) {
                        console.log(`Debug: Encontrado via regexCollationCount: ${total_results}`);
                        break;
                    }
                }
            } catch (err) {
                if (err.message.includes('Execution context was destroyed')) {
                    console.log('Debug: Contexto destruído (redirect?), retentando...');
                } else {
                    console.error('Debug: Erro no loop de scraping:', err.message);
                }
            }

            attempts++;
            if (attempts < maxAttempts) await new Promise(r => setTimeout(r, 200));
        }

        console.log(`Debug: Loop finished. Final total_results: ${total_results}`);

        const result = {
            "bb-ads": {
                total_search_results: total_results
            }
        };

        await page.close();
        return res.json(result);

    } catch (error) {
        console.error('Error scraping:', error);

        if (page) {
            try { await page.close(); } catch (e) { }
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
