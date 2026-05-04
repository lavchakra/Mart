const fs = require('fs');
const cp = require('child_process');

const d = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const users = Object.keys(d.users || {});
const results = [];

for (const u of users) {
  try {
    const cmd = `curl -s -X POST -H "Content-Type: application/json" -d '${JSON.stringify({ email: u, password: 'Test@1234' })}' http://127.0.0.1:3002/api/auth/login`;
    const res = cp.execSync(cmd, { encoding: 'utf8', timeout: 20000 });
    results.push({ email: u, ok: true, response: res.trim() });
  } catch (e) {
    results.push({ email: u, ok: false, error: e.message, stdout: e.stdout ? String(e.stdout) : '' });
  }
}

fs.writeFileSync('test-login-results.json', JSON.stringify(results, null, 2));
console.log('Login attempts complete. Results written to test-login-results.json');
