import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import pLimit from 'p-limit';

puppeteer.use(StealthPlugin());

const paisesPermitidos = ['Spain', 'England', 'Portugal', 'Russia', 'Poland', 'Belgium'];
const competicionesValidas = [
  'Spain - La Liga',
  'Spain - Segunda Division',
  'Spain - Copa del Rey',
  'Spain - Supercopa de España',
  'England - Premier League',
  'England - FA Cup',
  'England - EFL Cup',
  'England - Community Shield',
  'Italy - Serie A',
  'Italy - Coppa Italia',
  'Italy - Supercoppa Italiana',
  'Germany - Bundesliga',
  'Germany - DFB Pokal',
  'Germany - DFL-Supercup',
  'Europe - UEFA Champions League',
  'Europe - UEFA Europa League',
  'Europe - UEFA Europa Conference League',
  'Europe - UEFA Super Cup',
  'FIFA - Club World Cup',
  'Europe - UEFA European Championship',
  'FIFA - World Cup',
  'Europe - UEFA Nations League',
  'Club Friendly'
];

export async function getPartidosPorCompeticion() {
const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: '/usr/bin/chromium-browser',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
  const page = await browser.newPage();

  const hoy = new Date();
  const manana = new Date();
  manana.setDate(hoy.getDate() + 1);

  function formatear(date) {
    return date.toISOString().split('T')[0];
  }

  const urls = [
    `https://www.livesoccertv.com/schedules/${formatear(hoy)}/`,
    `https://www.livesoccertv.com/schedules/${formatear(manana)}/`
  ];

  const partidosTotales = [];

  for (const url of urls) {
    await page.goto(url, { waitUntil: 'networkidle2' });

    const partidos = await page.evaluate((competicionesValidas) => {
      const data = [];
      let competenciaActual = '';

      document.querySelectorAll('table.schedules tbody tr').forEach(row => {
        if (row.children.length === 1 && !row.querySelector('.matchrow')) {
          competenciaActual = row.innerText.trim();
        } else if (row.matches('tr.matchrow') && competicionesValidas.includes(competenciaActual)) {
          const hora = row.querySelector('.timecell')?.innerText?.trim() || '';
          const partido = row.querySelector('#match a')?.innerText?.trim() || '';
          const enlacePartido = row.querySelector('#match a')?.href || '';
          data.push({ hora, partido, competencia: competenciaActual, enlacePartido });
        }
      });

      return data;
    }, competicionesValidas);

    partidosTotales.push(...partidos);
  }

  const limit = pLimit(3);

  await Promise.all(partidosTotales.map(partido => limit(async () => {
    if (!partido.enlacePartido) {
      partido.canales = [];
      partido.logoLocal = '';
      partido.logoVisitante = '';
      return;
    }

    console.log(`📺 Buscando canales y logos para: ${partido.partido}`);

    const detallePage = await browser.newPage();
    try {
      await detallePage.goto(partido.enlacePartido, { waitUntil: 'networkidle2', timeout: 60000 });

      const detalles = await detallePage.evaluate((paisesPermitidos) => {
        const canales = [];
        const filas = document.querySelectorAll('table.ichannels tr');
        filas.forEach(tr => {
          const pais = tr.querySelector('td:nth-child(1)')?.innerText?.trim();
          const emisoras = Array.from(tr.querySelectorAll('td:nth-child(2) a'))
                                .map(a => a.innerText.trim()).join(', ');

          if (pais && emisoras && paisesPermitidos.includes(pais)) {
            canales.push(`${pais}: ${emisoras}`);
          }
        });

        const limpiarUrl = (url) => url.split('?')[0];

        const logoLocal = limpiarUrl(document.querySelector('.m-logo-left img')?.src || '');
        const logoVisitante = limpiarUrl(document.querySelector('.m-logo-right img')?.src || '');

        return { canales, logoLocal, logoVisitante };
      }, paisesPermitidos);

      partido.canales = detalles.canales;
      partido.logoLocal = detalles.logoLocal;
      partido.logoVisitante = detalles.logoVisitante;

    } catch (err) {
      console.error(`❌ Error extrayendo información para: ${partido.partido}`, err.message);
      partido.canales = [];
      partido.logoLocal = '';
      partido.logoVisitante = '';
    } finally {
      await detallePage.close();
    }
  })));

  await browser.close();
  return partidosTotales;
}
