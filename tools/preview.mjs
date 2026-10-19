import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const dir=path.resolve('dist');
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(dir,pathname==='/'?'index.html':'.'+pathname);
  if(!file.startsWith(dir+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return}
  res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript; charset=utf-8':file.endsWith('.png')?'image/png':'text/html; charset=utf-8');
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'");fs.createReadStream(file).pipe(res);
});
const port=Number(process.env.ARCHIVE_PREVIEW_PORT||4326);
server.listen(port,'127.0.0.1',()=>console.log(`Isolated preview: http://127.0.0.1:${port}`));
