const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'speedmesh-chrome-'));
const chrome = spawn(process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-pipe', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1280,900', '--user-data-dir=' + profile], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
let nextId = 0, buffer = '', pending = new Map(), errors = [];
chrome.stdio[4].on('data', data => {
    buffer += data.toString();
    let index;
    while ((index = buffer.indexOf('\0')) !== -1) {
        const message = JSON.parse(buffer.slice(0, index)); buffer = buffer.slice(index + 1);
        if (message.id) {
            const task = pending.get(message.id); pending.delete(message.id);
            message.error ? task.reject(message.error) : task.resolve(message.result);
        }
        if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId; pending.set(id, { resolve, reject });
    chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
});
const stub = `window.chrome={storage:{sync:{get:(keys,cb)=>cb({}),set:(d,cb)=>cb?.()},local:{get:(keys,cb)=>cb({}),set:(d,cb)=>cb?.()},onChanged:{addListener:()=>{}}},runtime:{getURL:file=>'/'+file,getManifest:()=>({version:'3.4'}),onMessage:{addListener:()=>{}},sendMessage:async()=>({ok:true,hours:24,nextAt:Date.now()+86400000})},tabs:{query:(q,cb)=>cb([]),create:()=>{},sendMessage:()=>{}}};window.fetch=async()=>new Response('[]',{headers:{'Content-Type':'application/json'}});`;
const manifest = JSON.parse(fs.readFileSync('manifest.json'));
const scripts = manifest.content_scripts.flatMap(group => group.js);
const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
    if (req.url === '/journal') {
        res.end('<!doctype html><html><head><script>' + stub + '</script></head><body style="font-family:system-ui;background:#f8fafc;padding:40px"><h1>Журнал группы • проверка интерфейса</h1><table><thead><tr><th>Обучающийся</th><th>03.11</th><th>Средний балл</th></tr></thead><tbody><tr><td>Иванов Иван</td><td data-test-component="markCell-1_100_200">5</td><td>4.75</td></tr></tbody></table>' + scripts.map(file => '<script src="/' + file + '"></script>').join('') + '</body></html>');
    } else if (req.url === '/popup.html') {
        res.end(fs.readFileSync('popup.html', 'utf8').replace('<head>', '<head><script>' + stub + '</script>'));
    } else {
        const file = path.join(root, path.basename(req.url));
        if (fs.existsSync(file)) res.end(fs.readFileSync(file)); else { res.statusCode = 404; res.end(''); }
    }
});
(async () => {
    try {
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        const base = 'http://127.0.0.1:' + server.address().port;
        const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
        const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
        await send('Runtime.enable', {}, sessionId);
        await send('Page.enable', {}, sessionId);
        await send('Page.navigate', { url: base + '/journal' }, sessionId);
        await new Promise(resolve => setTimeout(resolve, 1800));
        const evaluate = async expression => {
            const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
            if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description);
            return result.result.value;
        };
        const bounds = await evaluate(`(()=>{const card=document.getElementById('mesh-timer-card');const r=card.getBoundingClientRect();return {right:innerWidth-r.right,bottom:innerHeight-r.bottom,text:card.innerText}})()`);
        assert(Math.abs(bounds.right - 20) < 1); assert(Math.abs(bounds.bottom - 20) < 1);
        await evaluate('drawRobotPanel(0); window.MeshTasks.open()');
        assert.equal(await evaluate(`document.getElementById('mesh-robot-panel').parentElement.id`), 'mesh-task-controls');
        await evaluate(`window.browserTask = window.MeshTasks.start({title:'Обновление КТП',total:12,cancellable:true}); browserTask.update({current:7,message:'КТП 8 из 12: пересчёт'});`);
        assert.equal(await evaluate(`document.querySelector('.mesh-task-row progress').value`), 7);
        fs.writeFileSync(path.join(os.tmpdir(), 'speedmesh-journal.png'), Buffer.from((await send('Page.captureScreenshot', {}, sessionId)).data, 'base64'));
        await evaluate(`history.pushState({},'', '/schedule')`);
        await new Promise(resolve => setTimeout(resolve, 650));
        assert.equal(await evaluate(`document.getElementById('mesh-robot-panel')===null`), true);
        assert.equal(await evaluate(`document.querySelector('.mesh-task-row').dataset.status`), 'running');
        await evaluate(`document.querySelector('.mesh-task-stop').click()`);
        assert.equal(await evaluate(`browserTask.cancelled`), true);
        await evaluate(`browserTask.finish('cancelled','Обработка остановлена после текущего плана')`);
        assert.equal(await evaluate(`document.querySelector('.mesh-task-row').dataset.status`), 'cancelled');
        await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: profile }, undefined);
        await evaluate(`(async()=>{
            const zip=new JSZip();
            zip.file('xl/worksheets/sheet1.xml','<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Иванов Иван</t></is></c><c r="B1"><v>5</v></c><c r="C1"><v>4</v></c></row></sheetData></worksheet>');
            const bytes=await zip.generateAsync({type:'uint8array'});
            sessionStorage.setItem('MESH_MENTOR_GROUPS',JSON.stringify([{id:1,name:'ИСП2311 ОС'}]));
            window.fetch=async()=>new Response(bytes);
            window.dispatchEvent(new Event('speedmesh:buildSummarySheet'));
        })()`);
        await evaluate(`new Promise((resolve,reject)=>{
            const end=Date.now()+5000;
            const check=()=>document.getElementById('mesh-summary-export-xlsx')?resolve(true):Date.now()>end?reject(new Error('Summary timeout')):setTimeout(check,50);check();
        })`);
        const modalOnTop = await evaluate(`(()=>{const r=document.querySelector('#mesh-summary-export-xlsx').getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.id;})()`);
        assert.equal(modalOnTop, 'mesh-summary-export-xlsx');
        fs.writeFileSync(path.join(os.tmpdir(), 'speedmesh-summary.png'), Buffer.from((await send('Page.captureScreenshot', {}, sessionId)).data, 'base64'));
        await evaluate(`document.querySelector('#mesh-summary-export-xlsx').click()`);
        await evaluate(`new Promise((resolve,reject)=>{
            const end=Date.now()+5000;
            const check=()=>document.querySelector('.mesh-task-row').dataset.status==='done'?resolve(true):Date.now()>end?reject(new Error('Excel timeout')):setTimeout(check,50);check();
        })`);
        let workbookPath;
        for (let attempt=0;attempt<30;attempt++) {
            workbookPath=fs.readdirSync(profile).find(file=>file.endsWith('.xlsx'));
            if(workbookPath) break;
            await new Promise(resolve=>setTimeout(resolve,100));
        }
        assert(workbookPath,'Excel download must complete');
        const workbook=fs.readFileSync(path.join(profile,workbookPath));
        assert.equal(workbook[0],0x50);assert.equal(workbook[1],0x4b);
        fs.writeFileSync(path.join(os.tmpdir(),'speedmesh-summary-check.xlsx'),workbook);
        assert.deepEqual(errors, []);
        await send('Page.navigate', { url: base + '/popup.html' }, sessionId);
        await new Promise(resolve => setTimeout(resolve, 800));
        fs.writeFileSync(path.join(os.tmpdir(), 'speedmesh-popup.png'), Buffer.from((await send('Page.captureScreenshot', {}, sessionId)).data, 'base64'));
        assert.equal(await evaluate(`document.querySelector('.version-badge').textContent`), 'v3.4');
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ browser: 'Google Chrome headless', allContentScripts: scripts.length, timer: bounds, routeCleanup: true, taskCenter: true, excelWorkbook: true, popup: true, errors, screenshots: [path.join(os.tmpdir(), 'speedmesh-journal.png'), path.join(os.tmpdir(), 'speedmesh-popup.png')] }, null, 2));
    } finally {
        await send('Browser.close').catch(() => {});
        server.close();
        setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 500);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
setTimeout(() => { chrome.kill(); process.exit(1); }, 20000).unref();
