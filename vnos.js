const puppeteer = require('puppeteer');
const fs = require('fs');
const readline = require('readline');

const JSON_FILE = 'vprasanja.json';

// Globalno stanje za kontrole v živo prek tipkovnice
const controls = {
  isPaused: false,
  skipCurrentWait: false,
  manualDeleteAndSkip: false
};

// Nastavitev poslušanja tipkovnice v realnem času
readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

process.stdin.on('keypress', (str, key) => {
  if (key.ctrl && key.name === 'c') {
    console.log('\n\x1b[38;2;255;95;95m[SISTEM] Prekinitev izvajanja prek Ctrl+C.\x1b[0m');
    process.exit();
  }

  const k = key.name ? key.name.toLowerCase() : (str ? str.toLowerCase() : '');

  if (k === 'p') {
    controls.isPaused = !controls.isPaused;
    if (controls.isPaused) {
      process.stdout.write('\n\n\x1b[48;2;255;175;0m\x1b[38;2;0;0;0m ⏸ PAVZA \x1b[0m \x1b[38;2;255;175;0mSkripta je zaustavljena. Pritisnite [p] za nadaljevanje...\x1b[0m\n');
    } else {
      process.stdout.write('\x1b[48;2;0;215;135m\x1b[38;2;0;0;0m ▶ NADALJEVANJE \x1b[0m \x1b[38;2;0;215;135mSkripta nadaljuje z delom.\x1b[0m\n');
    }
  } else if (k === 's') {
    controls.skipCurrentWait = true;
    process.stdout.write('\n\x1b[38;2;0;215;255m[UKAZ] Prekinjam čakanje in nadaljujem takoj!\x1b[0m\n');
  } else if (k === 'd') {
    controls.manualDeleteAndSkip = true;
    controls.skipCurrentWait = true;
    process.stdout.write('\n\x1b[38;2;255;95;95m[UKAZ] Zahtevan ročni izbris in preskok trenutnega vprašanja!\x1b[0m\n');
  }
});

// Preverjanje pavze
async function checkPause() {
  while (controls.isPaused) {
    await new Promise(resolve => setTimeout(resolve, 150));
  }
}

// Kratka vmesna čakanja
async function waitRandom(minMs, maxMs, akcijaOpis) {
  await checkPause();
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
  const sekunde = (delay / 1000).toFixed(2);
  console.log(`\x1b[38;2;120;120;120m[ČAKANJE] ${akcijaOpis} ... ${sekunde}s\x1b[0m`);
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Sodoben kiber-zelen progress bar z gladkim polnjenjem in ANSI barvami
async function waitWithProgressBar(minMs, maxMs, akcijaOpis) {
  await checkPause();
  const totalMs = Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
  const totalSec = (totalMs / 1000).toFixed(1);
  const barLength = 28;
  const intervalMs = 100;
  let elapsedMs = 0;

  controls.skipCurrentWait = false;

  console.log(`\n\x1b[38;2;0;255;160m┏━━ [ODMOR] ${akcijaOpis} (${totalSec}s)\x1b[0m`);
  console.log(`\x1b[38;2;100;120;130m┣━━ Kontrole: \x1b[38;2;0;255;160m[p]\x1b[38;2;100;120;130m pavza/nadaljuj | \x1b[38;2;0;215;255m[s]\x1b[38;2;100;120;130m takoj preskoči odmor | \x1b[38;2;255;95;95m[d]\x1b[38;2;100;120;130m izbriši vprašanje\x1b[0m`);

  const partialChars = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];

  return new Promise(resolve => {
    const timer = setInterval(async () => {
      if (controls.isPaused) return;

      if (controls.skipCurrentWait) {
        clearInterval(timer);
        process.stdout.write('\r\x1b[K\x1b[38;2;0;215;255m┗━━ Odštevanje preskočeno.\x1b[0m\n\n');
        resolve();
        return;
      }

      elapsedMs += intervalMs;
      const progress = Math.min(elapsedMs / totalMs, 1);
      
      const fullCount = Math.floor(progress * barLength);
      const remainder = (progress * barLength) - fullCount;
      const partIdx = Math.floor(remainder * 8);
      const partialChar = fullCount < barLength ? partialChars[partIdx] : '';
      const emptyCount = Math.max(0, barLength - fullCount - (partialChar ? 1 : 0));

      const filledBar = '\x1b[38;2;0;255;160m' + '█'.repeat(fullCount) + (partialChar ? partialChar : '');
      const emptyBar = '\x1b[38;2;30;45;40m' + '░'.repeat(emptyCount) + '\x1b[0m';
      
      const percentStr = (progress * 100).toFixed(1).padStart(5, ' ');
      const remSec = Math.max(0, ((totalMs - elapsedMs) / 1000)).toFixed(1).padStart(4, ' ');

      process.stdout.write(`\r\x1b[K\x1b[38;2;0;255;160m┗━━ \x1b[38;2;0;200;120m[${filledBar}${emptyBar}\x1b[38;2;0;200;120m] \x1b[1m\x1b[38;2;255;255;255m${percentStr}%\x1b[0m \x1b[38;2;100;150;130m│ Preostalo: \x1b[38;2;0;255;160m${remSec}s\x1b[38;2;100;150;130m / ${totalSec}s\x1b[0m`);

      if (elapsedMs >= totalMs) {
        clearInterval(timer);
        process.stdout.write('\n\n');
        resolve();
      }
    }, intervalMs);
  });
}

// Simulacija človeškega tipkanja z možnostjo pavze pri VSAKEM posameznem znaku
async function humanType(page, selector, text, opis) {
  await checkPause();
  console.log(`\x1b[38;2;0;200;255m[VNOS]\x1b[0m Tipkam: ${opis}`);
  await page.waitForSelector(selector);
  await page.evaluate((sel) => document.querySelector(sel).click(), selector);
  await page.evaluate((sel) => document.querySelector(sel).value = '', selector);

  for (let i = 0; i < text.length; i++) {
    // Preveri ali je uporabnik med tipkanjem pritisnil [p]
    await checkPause();

    if (controls.manualDeleteAndSkip) {
      return;
    }

    const char = text[i];
    await page.type(selector, char);
    
    // Naključen zamik med pritiski tipk (človeška hitrost)
    const keyDelay = Math.floor(Math.random() * 35) + 15;
    await new Promise(r => setTimeout(r, keyDelay));
  }
}

// Izbira elementa v prilagojenem multi-select meniju
async function selectMSelectOption(page, rootId, optionText, opis) {
  await checkPause();
  console.log(`\x1b[38;2;180;130;255m[IZBIRA]\x1b[0m ${opis}: \x1b[1m${optionText}\x1b[0m`);
  await page.waitForSelector(`#${rootId}:not(.mselect--disabled)`, { timeout: 15000 });

  const triggerSelector = `#${rootId} .mselect__trigger`;
  await page.evaluate((sel) => document.querySelector(sel).click(), triggerSelector);
  await waitRandom(400, 800, `Odpiranje seznama za ${opis}`);

  const found = await page.evaluate((rootId, text) => {
    const options = Array.from(document.querySelectorAll(`#${rootId} .mselect__item`));
    for (const opt of options) {
      const spanText = opt.querySelector('span').textContent.trim();
      if (spanText === text) {
        opt.click();
        return true;
      }
    }
    return false;
  }, rootId, optionText);

  if (!found) {
    console.log(`\x1b[38;2;255;95;95m[OPOZORILO] Opcije '${optionText}' ni bilo mogoče najti v ${rootId}.\x1b[0m`);
  }

  await page.evaluate(() => document.body.click());
  await waitRandom(300, 500, `Zapiranje seznama za ${opis}`);
}


const FAILED_FILE = 'neuspela.json';
const MAX_ATTEMPTS = 3;          // kolikokrat poskusi isto vprašanje, preden ga prestavi v neuspela.json
const STEP1_RETRIES = 1;         // 1 = ob napaki pri preverjanju duplikatov takoj preskoči na naslednje vprašanje

function saveQueue(questionsArray) {
  fs.writeFileSync(JSON_FILE, JSON.stringify(questionsArray, null, 2), 'utf-8');
}

// Vprašanja, ki niso bila vnesena, se NE izgubijo – shranijo se v neuspela.json z razlogom
function saveFailed(q, reason) {
  let arr = [];
  if (fs.existsSync(FAILED_FILE)) {
    try { arr = JSON.parse(fs.readFileSync(FAILED_FILE, 'utf-8')); } catch { arr = []; }
  }
  arr.push({ ...q, _razlog: reason, _cas: new Date().toISOString() });
  fs.writeFileSync(FAILED_FILE, JSON.stringify(arr, null, 2), 'utf-8');
}

// Ali je element z danim ID-jem viden (nima razreda .hidden)
async function isVisible(page, id) {
  return page.evaluate((id) => {
    const el = document.getElementById(id);
    return !!el && !el.classList.contains('hidden');
  }, id);
}

// Zapre morebitno okno z napako na portalu
async function closeErrorModal(page) {
  await page.evaluate(() => {
    const modal = document.getElementById('error-modal');
    const btn = document.querySelector('#error-modal-ok');
    if (modal && !modal.classList.contains('hidden') && btn) btn.click();
  });
}

// Klik "Next" v koraku 1 in čakanje na rezultat preverjanja duplikatov.
// Vrne: 'ok' (korak 2 je odklenjen), 'duplicate' (portal javi podobno vprašanje) ali 'failed'.
async function submitStep1(page) {
  for (let poskus = 1; poskus <= STEP1_RETRIES; poskus++) {
    await checkPause();
    await page.evaluate(() => document.querySelector('#step1-next-btn').click());
    console.log(`\x1b[38;2;120;120;120m[ČAKANJE] Preverjanje duplikatov (poskus ${poskus}/${STEP1_RETRIES}) ...\x1b[0m`);

    const izid = await page.waitForFunction(() => {
      const vis = (id) => { const el = document.getElementById(id); return !!el && !el.classList.contains('hidden'); };
      if (vis('duplicate-warning')) return 'duplicate';
      const skill = document.querySelector('#skill-mselect');
      if (skill && !skill.classList.contains('mselect--disabled')) return 'ok';
      if (vis('error-modal')) return 'error';
      return false;
    }, { timeout: 30000, polling: 500 })
      .then(h => h.jsonValue())
      .catch(() => 'timeout');

    if (izid === 'ok') {
      // kratka stabilizacija – opozorilo o duplikatu se lahko prikaže z zamikom
      await waitRandom(800, 1200, 'Stabilizacija po preverjanju duplikatov');
      return (await isVisible(page, 'duplicate-warning')) ? 'duplicate' : 'ok';
    }
    if (izid === 'duplicate') return 'duplicate';

    console.log(`\x1b[38;2;255;175;0m[OPOZORILO] Preverjanje duplikatov ni uspelo (${izid}). Portal je verjetno preobremenjen.\x1b[0m`);
    await closeErrorModal(page);
    if (poskus < STEP1_RETRIES) {
      await waitRandom(8000 * poskus, 12000 * poskus, 'Čakam pred ponovnim preverjanjem duplikatov');
    }
  }
  return 'failed';
}

(async () => {
  if (!fs.existsSync(JSON_FILE)) {
    console.log(`\x1b[38;2;255;95;95m[NAPAKA] Datoteka ${JSON_FILE} ne obstaja.\x1b[0m`);
    process.exit();
  }

  let questions = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  let counter = 1;
  const attempts = new Map();

  // Odstrani trenutno vprašanje iz vrste in ga shrani v neuspela.json
  function dropCurrent(reason) {
    const q = questions.shift();
    if (q) saveFailed(q, reason);
    saveQueue(questions);
    counter++;
  }

  if (questions.length === 0) {
    console.log('\x1b[38;2;0;255;160m[SISTEM] V datoteki ni več nobenega vprašanja.\x1b[0m');
    process.exit();
  }

  console.log(`\n\x1b[1m\x1b[38;2;0;255;160mAKADIMOS AVTOMATIZACIJA VNOSA\x1b[0m`);
  console.log(`\x1b[38;2;120;120;120mPreostanek v čakalni vrsti: \x1b[1m${questions.length} vprašanj\x1b[0m`);
  console.log(`\x1b[38;2;120;120;120mUkazi kadarkoli med delom:`);
  console.log(`  \x1b[38;2;0;255;160m[p]\x1b[0m Pavza / Nadaljevanje (ustavi se takoj, tudi sredi stavka)`);
  console.log(`  \x1b[38;2;0;215;255m[s]\x1b[0m Takoj preskoči odštevalnik`);
  console.log(`  \x1b[38;2;255;95;95m[d]\x1b[0m Odstrani trenutno vprašanje (shrani se v ${FAILED_FILE}) in pojdi naprej\n`);

  const browser = await puppeteer.launch({
    channel: 'chrome',
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  // Uporabite že odprti privzeti zavihek:
  const pages = await browser.pages();
  const page = pages[0];

  // 1. Prijava
  console.log('\x1b[38;2;0;255;160m[KORAK 0]\x1b[0m Prijava v portal...');
  await page.goto('https://akadimos.lpt.feri.um.si/login?next=/', { waitUntil: 'networkidle2' });
  await waitRandom(800, 1500, 'Nalaganje prijavne strani');

  await humanType(page, '#email', 'um1@akadimos.lpt.feri.um.si', 'Email naslov');
  await waitRandom(400, 800, 'Premik na geslo');

  await humanType(page, '#password', 'xK9#mQ2$vL8!pZ4*', 'Geslo');
  await waitRandom(400, 800, 'Priprava na klik');

  await page.click('.btn-auth-submit');

  try {
    await page.waitForSelector('#header-user-menu-btn, .header-user', { timeout: 10000 });
    console.log('\x1b[38;2;0;255;160m✔ Prijava uspešno potrjena.\x1b[0m\n');
  } catch {
    await waitRandom(1500, 2500, 'Stabilizacija seje');
  }

  // 2. Glavna zanka
  while (questions.length > 0) {
    await checkPause();

    if (controls.manualDeleteAndSkip) {
      controls.manualDeleteAndSkip = false;
      console.log(`\x1b[38;2;255;95;95m[ROČNI UKAZ] Odstranjujem vprašanje ${counter} (shranjeno v ${FAILED_FILE}).\x1b[0m`);
      dropCurrent('Ročno odstranjeno [d]');
      continue;
    }

    const q = questions[0];
    const key = q.question_id ?? q.question_text;
    console.log(`\x1b[38;2;0;255;160m==================================================\x1b[0m`);
    console.log(`\x1b[1m\x1b[38;2;255;255;255mObdelava vprašanja #${counter}\x1b[0m \x1b[38;2;120;120;120m(Še v vrsti: ${questions.length})\x1b[0m`);
    console.log(`\x1b[38;2;0;255;160m==================================================\x1b[0m`);

    try {
      await page.goto('https://akadimos.lpt.feri.um.si/create', { waitUntil: 'networkidle2' });
      await waitRandom(1000, 1800, 'Nalaganje obrazca');

      // --- KORAK 1: Question & Answers ---
      await humanType(page, '#question-text', q.question_text, 'Besedilo vprašanja');
      if (controls.manualDeleteAndSkip) continue;
      await waitRandom(400, 800, 'Premislek po vprašanju');

      for (let j = 0; j < q.answers.length; j++) {
        await checkPause();
        if (controls.manualDeleteAndSkip) break;

        if (j >= 4) {
          await page.evaluate(() => document.querySelector('#add-answer-btn').click());
          await waitRandom(250, 500, `Novo polje za odgovor ${j + 1}`);
        }

        const answerRows = await page.$$('#answers-container .answer-row');
        const currentRow = answerRows[j];

        const inputElement = await currentRow.$('.answer-input');
        await inputElement.click();
        await page.evaluate((el) => el.value = '', inputElement);

        // Tipkanje odgovora znak po znak
        for (let c = 0; c < q.answers[j].text.length; c++) {
          await checkPause();
          if (controls.manualDeleteAndSkip) break;
          await inputElement.type(q.answers[j].text[c]);
          await new Promise(r => setTimeout(r, Math.floor(Math.random() * 30) + 10));
        }
        if (controls.manualDeleteAndSkip) break;

        if (q.answers[j].is_correct) {
          const checkboxElement = await currentRow.$('.answer-radio');
          await checkboxElement.click();
          await waitRandom(150, 350, `Označitev pravilnega odgovora ${j + 1}`);
        }
      }

      if (controls.manualDeleteAndSkip) continue; // obravnava se na vrhu zanke

      console.log('\x1b[38;2;180;130;255m[IZBIRA]\x1b[0m Vloga: \x1b[1mCyber Incident Responder\x1b[0m');
      await page.select('#role-select', "4");
      await waitRandom(400, 800, 'Izbrana vloga');

      // Preverjanje duplikatov z več poskusi
      const step1 = await submitStep1(page);

      if (step1 === 'duplicate') {
        console.log(`\x1b[38;2;255;175;0m[OPOZORILO] Zaznana podobnost. Vprašanje prestavljam v ${FAILED_FILE}.\x1b[0m`);
        dropCurrent('Portal je zaznal podobno vprašanje (duplikat)');
        await waitRandom(1500, 2200, 'Kratek premor po preskoku');
        continue;
      }
      if (step1 === 'failed') {
        console.log(`\x1b[38;2;255;175;0m[PRESKOK] Preverjanje duplikatov ni uspelo – vprašanje izpuščam (shranjeno v ${FAILED_FILE}) in grem na naslednje.\x1b[0m`);
        dropCurrent('Preverjanje duplikatov na portalu ni uspelo');
        await waitRandom(2000, 4000, 'Kratek premor pred naslednjim vprašanjem');
        continue;
      }

      // --- KORAK 2: Klasifikacija ---
      await checkPause();
      await selectMSelectOption(page, 'skill-mselect', q.skill, 'Skill');
      await selectMSelectOption(page, 'knowledge-mselect', q.knowledge, 'Knowledge');

      console.log('\x1b[38;2;120;120;120m[ČAKANJE] Čakam na predloge Topic-ov (spinner)...\x1b[0m');
      await page.waitForSelector('#topic-loading.hidden', { timeout: 30000 });

      await page.evaluate(() => document.querySelector('.topic-cselect__trigger').click());
      await waitRandom(500, 900, 'Prikaz dropdowna za Topic');

      await page.evaluate(() => {
        const items = document.querySelectorAll('#topic-list .topic-cselect__item');
        for (const item of items) {
          if (!item.classList.contains('hidden')) {
            item.click();
            break;
          }
        }
      });
      console.log('         \x1b[38;2;0;255;160m✔ Najboljši predlagani Topic izbran.\x1b[0m');
      await waitRandom(300, 600, 'Priprava težavnosti');

      console.log(`\x1b[38;2;180;130;255m[IZBIRA]\x1b[0m Težavnost: \x1b[1mLevel ${q.difficulty}\x1b[0m`);
      await page.evaluate((level) => {
        const btn = document.querySelector(`.diff-stop[data-level="${level}"]`);
        if (btn) btn.click();
      }, q.difficulty);
      await waitRandom(400, 800, 'Priprava na IRT kalibracijo');

      await page.evaluate(() => document.querySelector('#step2-submit-btn').click());

      await waitRandom(600, 1000, 'Preverjanje difficulty duplicate opozorila');
      if (await isVisible(page, 'difficulty-duplicate-warning')) {
        console.log('\x1b[38;2;255;175;0m[OPOZORILO] Podobnost pri isti težavnosti. Potrjujem nadaljevanje...\x1b[0m');
        await page.evaluate(() => document.querySelector('#difficulty-duplicate-confirm-btn').click());
      }

      // --- KORAK 3: IRT Kalibracija ---
      await checkPause();
      console.log('\x1b[38;2;0;215;255m[KORAK 3] IRT Kalibracija (čakam na odziv LLM modela)...\x1b[0m');

      let result;
      try {
        result = await Promise.race([
          page.waitForSelector('#mismatch-state:not(.hidden)', { timeout: 90000 }).then(() => 'mismatch'),
          page.waitForSelector('#matched-state:not(.hidden)', { timeout: 90000 }).then(() => 'matched'),
          page.waitForSelector('#error-modal:not(.hidden)', { timeout: 90000 }).then(() => 'error')
        ]);
      } catch (e) {
        // Timeout pri IRT: vprašanje morda JE shranjeno – zato ga ne poskušamo znova, ampak ga zabeležimo
        console.log('\x1b[38;2;255;95;95m[NAPAKA] Timeout pri IRT kalibraciji – preverite na portalu, ali je vprašanje shranjeno.\x1b[0m');
        dropCurrent('Timeout pri IRT kalibraciji (preveri na portalu, ali je shranjeno)');
        continue;
      }

      if (result === 'mismatch') {
        console.log('\x1b[38;2;255;175;0m[IRT OPOZORILO] Mismatch ocene. Sprejemam predlog LLM (Option B)...\x1b[0m');
        await waitRandom(1500, 2500, 'Pregled mismatcha');
        await page.evaluate(() => document.querySelector('#change-level-btn').click());
        await waitRandom(800, 1500, 'Čakanje na resolucijo');

        await page.waitForSelector('#submit-item-resolved', { timeout: 10000 });
        await page.evaluate(() => document.querySelector('#submit-item-resolved').click());
      } else if (result === 'matched') {
        console.log('\x1b[38;2;0;255;160m✔ [IRT USPEH] Težavnost se popolnoma ujema z LLM oceno.\x1b[0m');
        await waitRandom(800, 1500, 'Pregled potrditve');
        await page.evaluate(() => document.querySelector('#submit-item-matched').click());
      } else if (result === 'error') {
        await closeErrorModal(page);
        throw new Error('Sistemska napaka pri IRT kalibraciji');
      }

      await page.waitForSelector('#saved-state:not(.hidden)', { timeout: 20000 });
      console.log('\x1b[38;2;0;255;160m✔ Vprašanje uspešno shranjeno v bazo!\x1b[0m');

      questions.shift();
      saveQueue(questions);
      counter++;

    } catch (error) {
      // Napaka pri tem vprašanju: skripta se NE ustavi. Vprašanje poskusi znova, po MAX_ATTEMPTS ga shrani v neuspela.json.
      const n = (attempts.get(key) || 0) + 1;
      attempts.set(key, n);
      console.log(`\x1b[38;2;255;95;95m[NAPAKA] ${error.message}\x1b[0m`);

      if (n >= MAX_ATTEMPTS) {
        console.log(`\x1b[38;2;255;95;95m[PRESKOK] Vprašanje ni uspelo ${n}x – prestavljam ga v ${FAILED_FILE}.\x1b[0m`);
        dropCurrent(`Napaka po ${n} poskusih: ${error.message}`);
      } else {
        console.log(`\x1b[38;2;255;175;0m[PONOVITEV] Isto vprašanje poskusim znova (poskus ${n + 1}/${MAX_ATTEMPTS}).\x1b[0m`);
        await waitWithProgressBar(30000, 60000, 'Premor pred ponovnim poskusom (portal si opomore)');
        continue;
      }
    }

    // Sodoben zeleni odmor med vprašanji
    if (questions.length > 0) {
      await waitWithProgressBar(60000, 120000, 'Premor pred začetkom naslednjega vprašanja');
    }
  }

  console.log('\n\x1b[1m\x1b[38;2;0;255;160m==================================================\x1b[0m');
  console.log('\x1b[1m\x1b[38;2;0;255;160m[SISTEM] Vsa vprašanja so bila obdelana!\x1b[0m');
  if (fs.existsSync(FAILED_FILE)) {
    console.log(`\x1b[38;2;255;175;0mNekatera vprašanja niso bila vnesena – glej ${FAILED_FILE}.\x1b[0m`);
  }
  console.log('\x1b[1m\x1b[38;2;0;255;160m==================================================\x1b[0m');
  process.exit();
})();
