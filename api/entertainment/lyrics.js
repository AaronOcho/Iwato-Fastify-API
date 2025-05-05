const meta = {
  name: 'Lyrics',
  desc: 'Retrieves lyrics for a specified song and artist',
  category: 'Entertainment',
  params: ['artist', 'song'],
};

async function onStart({ request, reply }) {
  const { artist, song } = request.query;

  if (!artist || !song) {
    return reply.status(400).send({
      error: 'Missing required parameters: artist and song',
      timestamp: new Date().toISOString(),
      powered_by: 'Iwato Rest API'
    });
  }

  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.lyrics) {
      return reply.send({
        lyrics: data.lyrics,
        timestamp: new Date().toISOString(),
        powered_by: 'Iwato Rest API'
      });
    } else {
      return reply.status(404).send({
        error: 'Lyrics not found',
        timestamp: new Date().toISOString(),
        powered_by: 'Iwato Rest API'
      });
    }
  } catch (error) {
    return reply.status(500).send({
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
      powered_by: 'Iwato Rest API'
    });
  }
}

module.exports = { meta, onStart };