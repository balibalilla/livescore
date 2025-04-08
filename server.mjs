import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPartidosPorCompeticion } from './laligaParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pagina.html'));
});

app.get('/api/partidos', async (req, res) => {
  try {
    const partidos = await getPartidosPorCompeticion();
    res.json(partidos);
  } catch (error) {
    console.error('❌ Error al obtener los partidos:', error);
    res.status(500).json({ error: 'Error al obtener los partidos' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});
