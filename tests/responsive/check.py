"""Headless Edge viewport smoke check; fixture APIs, no live accounts."""
import base64, json, os, subprocess, tempfile, threading, time
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import requests
from websockets.sync.client import connect
root = Path(__file__).resolve().parents[2]
out = root / 'evidence' / 'responsive'
out.mkdir(parents=True, exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(root/'RentWise-Frontend/dist'),**kwargs)
    def log_message(self,*args): pass
    def do_GET(self):
        if self.path.startswith('/api/'):
            data = {'items': [], 'hasMore': False, 'nextCursor': None} if '/properties/browse' in self.path else []
            if '/auth/profile' in self.path: data={'fullName':'Test Owner','email':'test@example.com','role':'PropertyOwner'}
            if '/bank-details/' in self.path: data={'configured':False}
            self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(data).encode());return
        if not self.path.startswith('/assets/'): self.path='/index.html'
        return super().do_GET()
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
profile=tempfile.mkdtemp(prefix='rentwise-responsive-')
edge=Path(os.environ.get('PROGRAMFILES(X86)','C:/Program Files (x86)'))/'Microsoft/Edge/Application/msedge.exe'
process=subprocess.Popen([str(edge),'--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0',f'--user-data-dir={profile}','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
try:
    portfile=Path(profile)/'DevToolsActivePort'
    for _ in range(100):
        if portfile.exists():break
        time.sleep(.1)
    port=portfile.read_text().splitlines()[0]
    target=next(t for t in requests.get(f'http://127.0.0.1:{port}/json').json() if t['type']=='page')
    ws=connect(target['webSocketDebuggerUrl']);seq=0
    def command(method,params=None):
        global seq
        seq+=1;ws.send(json.dumps({'id':seq,'method':method,'params':params or {}}))
        while True:
            response=json.loads(ws.recv())
            if response.get('id')==seq:
                if 'error' in response:raise RuntimeError(response['error'])
                return response.get('result',{})
    def evaluate(js):return command('Runtime.evaluate',{'expression':js,'returnByValue':True}).get('result',{}).get('value')
    url=f'http://127.0.0.1:{server.server_port}'
    command('Page.navigate',{'url':url});time.sleep(.5)
    results=[]
    for role,route in [(None,'/'),(None,'/login'),(None,'/register'),(None,'/find-rentals'),('Tenant','/saved-items'),('Tenant','/rental-workflows'),('PropertyOwner','/properties'),('PropertyOwner','/profile'),('PropertyOwner','/tenants'),('PropertyOwner','/agreements'),('PropertyOwner','/maintenance'),('Administrator','/admin')]:
        token='e30.'+base64.urlsafe_b64encode(json.dumps({'sub':'fixture','role':role,'FullName':'Test User','email':'test@example.com','exp':int(time.time())+3600}).encode()).decode().rstrip('=')+'.sig'
        evaluate('localStorage.clear()')
        if role:evaluate('localStorage.setItem("token",'+json.dumps(token)+')')
        for width in [320,390,768,1440]:
            command('Emulation.setDeviceMetricsOverride',{'width':width,'height':900,'deviceScaleFactor':1,'mobile':False})
            command('Page.navigate',{'url':url+route});time.sleep(.8)
            for _ in range(40):
                if evaluate("document.querySelector('#root')?.innerText.length > 40 && !document.querySelector('[role=status] .sr-only')"):break
                time.sleep(.1)
            else:
                raise AssertionError(f'Page did not finish loading: {route} at {width}px')
            time.sleep(.3)
            result=evaluate("JSON.stringify({scroll:document.documentElement.scrollWidth,width:innerWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();let a=e.parentElement;while(a){if(['auto','scroll','hidden'].includes(getComputedStyle(a).overflowX))return false;a=a.parentElement;}return r.width>0&&r.right>innerWidth+2&&getComputedStyle(e).position!=='fixed'}).slice(0,8).map(e=>({tag:e.tagName,cls:String(e.className).slice(0,180),text:e.textContent.slice(0,60)}))})")
            actual=evaluate('location.pathname')
            assert actual==route, f'Unexpected redirect {route} -> {actual}'
            assert not evaluate("document.body.innerText.includes('We could not load this page')"), 'Render failure'
            row={'role':role,'route':route,**json.loads(result)};results.append(row)
            if row['scroll']>width+2:
                print(json.dumps(row),flush=True)
            if width in [320,390]:
                shot=command('Page.captureScreenshot',{'format':'png'})
                (out/((role or 'public')+'-'+route.strip('/').replace('/','-')+'-'+str(width)+'.png')).write_bytes(base64.b64decode(shot['data']))
    (out/'results.json').write_text(json.dumps(results,indent=2))
    print(f"Checked {len(results)} route/viewports; overflow cases: {sum(r['scroll']>r['width']+2 for r in results)}",flush=True)
    ws.close()
    assert all(r['scroll'] <= r['width'] + 2 for r in results), 'Horizontal page overflow detected'
finally:
    process.terminate();process.wait(timeout=15);server.shutdown();server.server_close()
