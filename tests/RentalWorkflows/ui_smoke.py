"""Headless Edge smoke test of the built React app with fixture-only HTTP APIs.
Run from repository root with RentWise-AgenticService/.venv/Scripts/python.exe.
No application database, external API or real account is used.
"""
import base64
import copy
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import requests
from websockets.sync.client import connect

root = Path(__file__).resolve().parents[2]
plan = ['MatchingLocation', 'PropertyVerification', 'AgreementPricing', 'MaintenanceTriage']
fixture = {'id': 'fixture', 'status': 'Ready', 'version': 1, 'createdAt': '2026-09-27T00:00:00Z',
           'canAdvance': True, 'canReview': False, 'steps': [], 'state': {'plan': plan, 'outputs': {}, 'decisions': [], 'attempts': 0}}
run = None
bank = {'bankName': '', 'branch': '', 'accountName': '', 'accountNumber': '', 'configured': False}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(root / 'RentWise-Frontend/dist'), **kwargs)
    def log_message(self, *args): pass
    def reply(self, value):
        data = json.dumps(value).encode(); self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)
    def do_GET(self):
        if self.path.startswith('/api/'):
            if self.path == '/api/rental-workflows': return self.reply([run] if run else [])
            if self.path.startswith('/api/rental-workflows/'): return self.reply(run)
            if self.path == '/api/bank-details/mine': return self.reply(bank)
            if self.path == '/api/auth/profile': return self.reply({'fullName': 'Test Owner', 'role': 'PropertyOwner'})
            return self.reply([])
        if not self.path.startswith('/assets/'): self.path = '/index.html'
        return super().do_GET()
    def do_POST(self):
        global run
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or '{}')
        if self.path == '/api/rental-workflows':
            run = copy.deepcopy(fixture); run['state']['request'] = body
        elif self.path.endswith('/advance'):
            role = plan[len(run['state']['outputs'])]
            output = {'propertyId': 'home', 'summary': f'{role} fixture summary'}
            if role == 'AgreementPricing': output.update(monthlyRent=50000, terms='Fixture agreement terms')
            if role == 'MaintenanceTriage': output['checklist'] = ['Fixture handover check']
            run['state']['outputs'][role] = output
            if len(run['state']['outputs']) == 4: run['status'] = 'AwaitingApproval'
        return self.reply(run)
    def do_PUT(self):
        global bank
        bank = json.loads(self.rfile.read(int(self.headers['Content-Length']))); bank['configured'] = True
        self.reply(bank)


server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}'
profile = tempfile.mkdtemp(prefix='rentwise-ui-smoke-')
edge = Path(os.environ.get('PROGRAMFILES(X86)', 'C:/Program Files (x86)')) / 'Microsoft/Edge/Application/msedge.exe'
process = subprocess.Popen([str(edge), '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', f'--user-data-dir={profile}', 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
try:
    port_file = Path(profile) / 'DevToolsActivePort'
    for _ in range(100):
        if port_file.exists(): break
        time.sleep(.1)
    port = port_file.read_text().splitlines()[0]
    target = next(t for t in requests.get(f'http://127.0.0.1:{port}/json').json() if t['type'] == 'page')
    ws = connect(target['webSocketDebuggerUrl']); sequence = 0
    browser_errors = []
    def command(method, params=None):
        global sequence
        sequence += 1; ws.send(json.dumps({'id': sequence, 'method': method, 'params': params or {}}))
        while True:
            response = json.loads(ws.recv())
            if response.get('method') == 'Runtime.exceptionThrown': browser_errors.append(response['params'])
            if response.get('id') == sequence:
                if 'error' in response: raise AssertionError(response['error'])
                return response.get('result', {})
    def evaluate(source):
        result = command('Runtime.evaluate', {'expression': source, 'returnByValue': True})
        if 'exceptionDetails' in result: raise AssertionError(result['exceptionDetails'])
        return result.get('result', {}).get('value')
    def wait_for(source):
        for _ in range(100):
            if evaluate(source): return
            time.sleep(.1)
        raise AssertionError((source, evaluate('location.href'), evaluate('document.body.innerText'), browser_errors))
    def click(text): evaluate(f"[...document.querySelectorAll('button')].find(b => b.textContent.trim() === {json.dumps(text)}).click()")
    def fill(selector, value):
        evaluate(f"(() => {{const e=document.querySelector({json.dumps(selector)});Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e),'value').set.call(e,{json.dumps(value)});e.dispatchEvent(new Event('input',{{bubbles:true}}));}})()")
    def token(role): return 'e30.' + base64.urlsafe_b64encode(json.dumps({'sub': 'fixture-user', 'role': role}).encode()).decode().rstrip('=') + '.fixture'
    command('Page.enable'); command('Runtime.enable')
    command('Page.addScriptToEvaluateOnNewDocument', {'source': "const originalOpen=XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open=function(method,url,...rest){const parsed=new URL(url,location.href); return originalOpen.call(this,method,location.origin+parsed.pathname+parsed.search,...rest);};"})
    command('Page.addScriptToEvaluateOnNewDocument', {'source': f"localStorage.setItem('token', {json.dumps(token('Tenant'))})"})
    command('Emulation.setDeviceMetricsOverride', {'width': 1440, 'height': 1000, 'deviceScaleFactor': 1, 'mobile': False})
    command('Page.navigate', {'url': url + '/rental-workflows'})
    wait_for("!!document.querySelector('textarea')")
    fill('textarea', 'Two bedrooms in Malabe with parking')
    click('Continue'); wait_for("!!document.querySelector('input[type=number]')")
    fill('input[type=number]', '100000')
    fill('input[type=date]', '2027-04-01'); fill('input[type=date]:last-of-type', '2027-04-01')
    evaluate("(() => {const e=document.querySelectorAll('input[type=date]')[1];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'2027-10-01');e.dispatchEvent(new Event('input',{bubbles:true}));})()")
    click('Find my next home')
    wait_for("document.body.textContent.includes('Why this home fits')")
    assert len(run['state']['outputs']) == 4
    assert not evaluate("document.body.textContent.includes('Fixture agreement terms')")
    click('Agreement'); wait_for("document.body.textContent.includes('Fixture agreement terms')")
    assert not evaluate("document.body.textContent.includes('Fixture handover check')")
    click('Move-in'); wait_for("document.body.textContent.includes('Fixture handover check')")
    screenshot = command('Page.captureScreenshot', {'format': 'png'})
    (Path(tempfile.gettempdir()) / 'rentwise-workflow-desktop.png').write_bytes(base64.b64decode(screenshot['data']))
    assert not evaluate("document.body.textContent.includes('Run remaining steps')")
    command('Emulation.setDeviceMetricsOverride', {'width': 390, 'height': 844, 'deviceScaleFactor': 1, 'mobile': True})
    assert evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    print('PASS: guided form, automatic chain, progressive tabs, mobile overflow')
    command('Page.addScriptToEvaluateOnNewDocument', {'source': f"localStorage.setItem('token', {json.dumps(token('PropertyOwner'))})"})
    command('Page.navigate', {'url': url + '/profile'})
    wait_for("document.body.textContent.includes('Save bank details')")
    for index, value in enumerate(['Test Bank', 'Test Branch', 'Test Owner', '001234567890']):
        evaluate(f"(() => {{const e=[...document.querySelectorAll('section')].find(s=>s.textContent.includes('Bank transfer details')).querySelectorAll('input')[{index}];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,{json.dumps(value)});e.dispatchEvent(new Event('input',{{bubbles:true}}));}})()")
    click('Save bank details'); wait_for("document.body.textContent.includes('Bank details saved.')")
    assert bank['accountNumber'] == '001234567890'
    print('PASS: owner bank details form saves exact account number')
    ws.close()
finally:
    process.terminate(); process.wait(timeout=15); server.shutdown()
