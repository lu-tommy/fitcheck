#!/usr/bin/env node
/**
 * Print an FITCHECK_USERS entry for one person.
 *
 *   npm run add-user -- sam
 *
 * The password is asked for without echoing and is never written anywhere: only
 * a scrypt hash and its salt end up in the environment file, so that file does
 * not hand anyone a way in if it leaks.
 */
import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline';
import { stdin, stdout, argv, exit } from 'node:process';

const username = (argv[2] ?? '').trim();
if (!/^[a-z0-9_-]{1,32}$/i.test(username)) {
  console.error('Usage: npm run add-user -- <name>   (letters, digits, - and _ only)');
  exit(1);
}

function askHidden(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    stdout.write(prompt);
    const onData = () => {
      // Redraw the prompt so the characters typed never appear.
      stdout.clearLine(0);
      stdout.cursorTo(0);
      stdout.write(prompt);
    };
    stdin.on('data', onData);
    rl.question('', (answer) => {
      stdin.off('data', onData);
      rl.close();
      stdout.write('\n');
      resolve(answer);
    });
  });
}

const password = await askHidden(`Password for ${username}: `);
if (password.length < 8) {
  console.error('Use at least eight characters.');
  exit(1);
}
if ((await askHidden('Again: ')) !== password) {
  console.error('Those did not match.');
  exit(1);
}

const salt = randomBytes(16).toString('hex');
const hash = scryptSync(password, salt, 64).toString('hex');

console.log('Add this to FITCHECK_USERS in .env.local (entries are separated by ;):');
console.log('');
console.log(`${username}:${salt}:${hash}`);
console.log('');
