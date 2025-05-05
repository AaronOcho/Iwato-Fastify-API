const axios = require('axios');

const meta = {
    name: 'Loli',
    desc: 'Loli random image',
    method: 'get',
    category: 'Anime',
};

async function onStart({ request, reply }) {
    try {
        const { data } = await axios.get(
            'https://raw.githubusercontent.com/rynxzyy/loli-r-img/refs/heads/main/links.json'
        );
        const imageUrl = data[Math.floor(Math.random() * data.length)];
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imgBuffer = Buffer.from(response.data);
        reply.header('Content-Type', 'image/png');
        return reply.send(imgBuffer);
    } catch (error) {
        return reply.status(500).send({ status: false, error: error.message });
    }
}

module.exports = { meta, onStart };