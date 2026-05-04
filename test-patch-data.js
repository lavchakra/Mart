const fs = require('fs');
const crypto = require('crypto');

const PATH = 'data.json';
const PASSWORD = 'Test@1234';

const raw = fs.readFileSync(PATH, 'utf8');
const d = JSON.parse(raw);

for (const email of Object.keys(d.users || {})) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(PASSWORD, salt, 1000, 64, 'sha512').toString('hex');
  d.users[email].salt = salt;
  d.users[email].hash = hash;
  if (d.users[email].password) delete d.users[email].password;
}

fs.writeFileSync(PATH, JSON.stringify(d, null, 2));
console.log('Patched data.json with test password for all users.');
