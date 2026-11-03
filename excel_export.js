// Minimal OOXML writer using the ZIP library already bundled with the extension.
(function () {
    const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
    function column(index) {
        let result = '';
        for (index++; index > 0; index = Math.floor((index - 1) / 26)) result = String.fromCharCode(65 + (index - 1) % 26) + result;
        return result;
    }
    function cell(row, col, value, style = 0) {
        const ref = `${column(col)}${row}`;
        if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
        return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
    }
    const markStyle = value => value == null ? 7 : value < 3 ? 6 : value < 3.5 ? 5 : 4;
    const row = (n, values, styles = []) => `<row r="${n}"${n === 4 ? ' ht="42" customHeight="1"' : ''}>${values.map((value, col) => cell(n, col, value, styles[col] || 0)).join('')}</row>`;
    const sheet = (rows, lastRow, lastColumn, widths, freezeColumns = 0) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
            <dimension ref="A1:${lastColumn}${lastRow}"/>
            <sheetViews><sheetView workbookViewId="0"><pane${freezeColumns ? ` xSplit="${freezeColumns}"` : ''} ySplit="4" topLeftCell="${column(freezeColumns)}5" activePane="${freezeColumns ? 'bottomRight' : 'bottomLeft'}" state="frozen"/></sheetView></sheetViews>
            <sheetFormatPr defaultRowHeight="21"/>
            <cols>${widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols>
            <sheetData>${rows.join('')}</sheetData>
            <autoFilter ref="A4:${lastColumn}${lastRow}"/>
            <mergeCells count="2"><mergeCell ref="A1:${lastColumn}1"/><mergeCell ref="A2:${lastColumn}2"/></mergeCells>
            <pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
        </worksheet>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
            <fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="16"/><name val="Calibri"/></font></fonts>
            <fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF334155"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill></fills>
            <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
            <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
            <cellXfs count="8">
                <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
                <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="center"/></xf>
                <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>
                <xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
                <xf numFmtId="2" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>
                <xf numFmtId="2" fontId="0" fillId="4" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>
                <xf numFmtId="2" fontId="0" fillId="5" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>
                <xf numFmtId="0" fontId="0" fillId="6" borderId="0" xfId="0" applyFill="1"/>
            </cellXfs>
            <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
        </styleSheet>`;

    async function createSummaryWorkbook({ courseName, yearStart, yearEnd, subjectsList, students, todayRuStr }) {
        if (!window.JSZip) throw new Error('Не загружен модуль Excel');
        const zip = new window.JSZip();
        const headers = ['№', 'ФИО обучающегося', ...subjectsList, 'Задолженностей', 'Средний балл', 'Статус'];
        const rows = [row(1, [`Сводная ведомость: ${courseName}`], [2]), row(2, [`Учебный год ${yearStart}–${yearEnd}. На ${todayRuStr}`]), row(4, headers, headers.map(() => 1))];
        students.forEach((student, i) => {
            const marks = subjectsList.map(subject => student.subjects[subject] ?? null);
            const values = [i + 1, student.name, ...marks.map(value => value ?? '—'), student.failedCount, student.overallAvg ?? '—', student.status];
            rows.push(row(i + 5, values, [0, 0, ...marks.map(markStyle), 0, markStyle(student.overallAvg), 0]));
        });
        const statistics = [
            row(1, [`Статистика: ${courseName}`], [2]), row(2, [`На ${todayRuStr}. Всего обучающихся: ${students.length}`]),
            row(4, ['Дисциплина', 'С оценками', 'Без оценок', 'С долгами', 'Средний балл'], [1, 1, 1, 1, 1])
        ];
        subjectsList.forEach((subject, i) => {
            const avgs = students.map(student => student.subjects[subject]).filter(value => typeof value === 'number' && Number.isFinite(value));
            const avg = avgs.length ? Number((avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(2)) : null;
            statistics.push(row(i + 5, [subject, avgs.length, students.length - avgs.length, avgs.filter(value => value < 3).length, avg ?? '—'], [0, 0, 0, 0, markStyle(avg)]));
        });
        const ns = 'http://schemas.openxmlformats.org/package/2006/relationships';
        const officeNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
        zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
        zip.file('_rels/.rels', `<Relationships xmlns="${ns}"><Relationship Id="rId1" Type="${officeNs}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
        zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${officeNs}"><sheets><sheet name="Ведомость" sheetId="1" r:id="rId1"/><sheet name="Статистика" sheetId="2" r:id="rId2"/></sheets></workbook>`);
        zip.file('xl/_rels/workbook.xml.rels', `<Relationships xmlns="${ns}"><Relationship Id="rId1" Type="${officeNs}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${officeNs}/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="${officeNs}/styles" Target="styles.xml"/></Relationships>`);
        zip.file('xl/styles.xml', styles);
        zip.file('xl/worksheets/sheet1.xml', sheet(rows, students.length + 4, column(headers.length - 1), [6, 34, ...subjectsList.map(() => 19), 19, 17, 22], 2));
        zip.file('xl/worksheets/sheet2.xml', sheet(statistics, subjectsList.length + 4, 'E', [48, 17, 17, 17, 19]));
        return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    }
    window.MeshExcel = { createSummaryWorkbook };
})();
