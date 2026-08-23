const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const tiles = await page.evaluate(() => {
    // procura os tiles (divs que contêm 'Enquadramento' e apanha o card inteiro)
    const all = [...document.querySelectorAll('div')];
    return all.filter(d => d.textContent?.includes('Enquadramento') || d.textContent?.includes('Modelo 3')).slice(0,4).map(d => ({ tag: d.tagName, cls: (d.className||'').toString().slice(0,60), txt: (d.textContent||'').slice(0,80) }));
  });
  console.log(JSON.stringify(tiles, null, 2));
  // dump da secção simuladores
  const sec = await page.evaluate(() => {
    const el = document.querySelector('#simuladores');
    return el ? el.innerText.slice(0, 2000) : 'SEM #simuladores';
  });
  console.log('SECÇÃO SIMULADORES:\n' + sec);
  await browser.close();
})();
