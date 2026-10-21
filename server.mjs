import http from 'node:http';
import {readFile} from 'node:fs/promises';
const port = Number(process.env.PORT || 4173);
const root = new URL('./dist/', import.meta.url);
const types = {html:'text/html',js:'text/javascript',css:'text/css',ino:'text/plain'};
http.createServer(async (req,res) => {
  try {
    const name = decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'') || 'index.html';
    if (name.includes('..') || name.includes('\\')) { res.writeHead(403).end(); return; }
    const data = await readFile(new URL(name,root));
    res.writeHead(200,{'Content-Type':types[name.split('.').pop()] || 'application/octet-stream','Cache-Control':'no-store'}).end(data);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port,'127.0.0.1',() => console.log('Local: http://127.0.0.1:' + port));

