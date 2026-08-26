import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function textContent(fragment) {
  return fragment
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function caseBlock(index) {
  const blocks = [...html.matchAll(/<article class="card kcase[^>]*>([\s\S]*?)<\/article>/g)];
  assert.equal(blocks.length, 3, 'expected exactly three case cards');
  return blocks[index][1];
}

test('hero states the exact buyer-volume offer', () => {
  const heading = html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1];
  assert.equal(
    textContent(heading ?? ''),
    'Приводим от 300 квалифицированных покупателей в ваш автосалон',
  );
});

test('case cards consistently show the approved funnels and CPL values', () => {
  const expected = [
    { leads: 300, visits: 60, sales: 6, cpl: 1500 },
    { leads: 200, visits: 40, sales: 4, cpl: 1480 },
    { leads: 100, visits: 20, sales: 2, cpl: 1520 },
  ];

  expected.forEach(({ leads, visits, sales, cpl }, index) => {
    const block = caseBlock(index);
    const title = textContent(block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? '');
    const stats = block.match(/<div class="kcase__stats[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)?.[1] ?? '';
    const funnel = block.match(/<div class="kfunnel[^>]*>([\s\S]*?)<\/div>\s*<p class="kcase__price">/)?.[1] ?? '';
    const price = textContent(block.match(/<p class="kcase__price">([\s\S]*?)<\/p>/)?.[1] ?? '');

    assert.match(title, new RegExp(`\\b${leads}\\b`));
    assert.match(stats, new RegExp(`data-count="${leads}"`));
    assert.match(stats, new RegExp(`data-count="${visits}"`));
    assert.match(stats, new RegExp(`data-count="${sales}"`));
    assert.match(funnel, new RegExp(`data-count="${leads}"`));
    assert.match(funnel, new RegExp(`data-count="${visits}"`));
    assert.match(funnel, new RegExp(`data-count="${sales}"`));
    assert.match(price, new RegExp(`${cpl.toLocaleString('ru-RU').replace(/\s/g, '\\s?')} ₽`));
  });

  const totals = expected.reduce(
    (sum, item) => ({
      leads: sum.leads + item.leads,
      visits: sum.visits + item.visits,
      sales: sum.sales + item.sales,
      cpl: sum.cpl + item.cpl,
    }),
    { leads: 0, visits: 0, sales: 0, cpl: 0 },
  );

  assert.equal(totals.visits / totals.leads, 0.2);
  assert.equal(totals.sales / totals.visits, 0.1);
  assert.equal(totals.cpl / expected.length, 1500);
});

test('main case modal and panel match the main card', () => {
  assert.match(html, /<div class="kcase__panel-foot"><span>300 лидов<\/span>/);
  assert.match(html, /300 лидов → 258 контактов → 60 визитов и тест-драйвов → 6 проданных автомобилей/);
  assert.match(html, /Стоимость подтверждённого лида — 1 500 ₽/);
});

test('automotive-business section states five years of experience', () => {
  assert.match(html, /5 лет работаем в автомобильном бизнесе/);
});
