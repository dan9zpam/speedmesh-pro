const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const JSZip = require('../jszip.min.js');
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

test('Excel workbook contains numeric marks, styles, frozen headers, filters and statistics', async t => {
    const dom = new JSDOM('', { runScripts: 'outside-only' }); t.after(() => dom.window.close());
    dom.window.JSZip = JSZip;
    dom.window.eval(fs.readFileSync(path.join(__dirname, '../excel_export.js'), 'utf8'));
    const subject = 'ОС & <практика> "1"';
    const data = {
        courseName: 'ИСП2311', yearStart: 2026, yearEnd: 2027, todayRuStr: '03.11.2026', subjectsList: [subject, '=Второй предмет'],
        students: [
            { name: 'Иванов Иван', subjects: { [subject]: 4.75, '=Второй предмет': 2.5 }, failedCount: 1, overallAvg: 3.63, status: 'Задолженность' },
            { name: '=Петров Петр', subjects: { [subject]: null, '=Второй предмет': 5 }, failedCount: 0, overallAvg: 5, status: 'Нет данных' }
        ]
    };
    const bytes = await dom.window.MeshExcel.createSummaryWorkbook(data);
    assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b);
    const zip = await JSZip.loadAsync(bytes);
    const parse = async file => {
        const text = await zip.file(file).async('string');
        const doc = new dom.window.DOMParser().parseFromString(text, 'application/xml');
        assert.equal(doc.getElementsByTagName('parsererror').length, 0, file);
        return doc;
    };
    for (const file of Object.keys(zip.files).filter(name => /\.(xml|rels)$/.test(name))) await parse(file);
    const workbook = await parse('xl/workbook.xml');
    assert.deepEqual([...workbook.getElementsByTagNameNS(ns, 'sheet')].map(s => s.getAttribute('name')), ['Ведомость', 'Статистика']);
    const sheet = await parse('xl/worksheets/sheet1.xml');
    const cell = ref => [...sheet.getElementsByTagNameNS(ns, 'c')].find(c => c.getAttribute('r') === ref);
    assert.equal(cell('C5').getAttribute('t'), null); assert.equal(cell('C5').textContent, '4.75');
    assert.equal(cell('D5').getAttribute('s'), '6');
    assert.equal(cell('C6').textContent, '—');
    assert.equal(cell('B6').getAttribute('t'), 'inlineStr'); assert.equal(cell('B6').textContent, '=Петров Петр');
    assert.equal(cell('C4').textContent, subject);
    assert.equal(sheet.getElementsByTagNameNS(ns, 'f').length, 0);
    const pane = sheet.getElementsByTagNameNS(ns, 'pane')[0];
    assert.equal(pane.getAttribute('topLeftCell'), 'C5'); assert.equal(pane.getAttribute('state'), 'frozen');
    assert.equal(sheet.getElementsByTagNameNS(ns, 'autoFilter')[0].getAttribute('ref'), 'A4:G6');
    const stats = await parse('xl/worksheets/sheet2.xml');
    const statsCell = ref => [...stats.getElementsByTagNameNS(ns, 'c')].find(c => c.getAttribute('r') === ref).textContent;
    assert.equal(statsCell('B5'), '1'); assert.equal(statsCell('C5'), '1'); assert.equal(statsCell('D6'), '1'); assert.equal(statsCell('E6'), '3.75');
});

test('Excel export supports columns beyond Z and an empty list', async t => {
    const dom = new JSDOM('', { runScripts: 'outside-only' }); t.after(() => dom.window.close());
    dom.window.JSZip = JSZip; dom.window.eval(fs.readFileSync(path.join(__dirname, '../excel_export.js'), 'utf8'));
    const bytes = await dom.window.MeshExcel.createSummaryWorkbook({ courseName: 'Группа', yearStart: 2026, yearEnd: 2027, todayRuStr: '03.11.2026', subjectsList: Array.from({ length: 30 }, (_, i) => `Предмет ${i}`), students: [] });
    const zip = await JSZip.loadAsync(bytes);
    const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
    assert(sheet.includes('A4:AI4')); assert(sheet.includes('r="AA4"'));
});
