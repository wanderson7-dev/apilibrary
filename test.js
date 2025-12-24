const axios = require('axios');

const testApi = async () => {
    try {
        console.log('Enviando requisição para a API...');
        const response = await axios.post('http://localhost:3000/api/scrape', {
            url: "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&source=page-transparency-widget&view_all_page_id=122102859884008073"
        });

        console.log('Resposta da API:');
        console.log(JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Erro ao testar a API:', error.message);
        if (error.response) {
            console.error('Dados do erro:', error.response.data);
        }
    }
};

testApi();
