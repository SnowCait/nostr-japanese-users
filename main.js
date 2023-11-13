import 'websocket-polyfill';
import * as fs from 'fs/promises';
import dotenv from 'dotenv';
import { program } from 'commander';
import { SimplePool, Kind, getPublicKey, nip19, getEventHash, signEvent } from 'nostr-tools';
import relays from './relays.json' assert { type: 'json' };
import readonlyRelays from './relays.readonly.json' assert { type: 'json' };
import { isProxy } from './nostr.js';

dotenv.config();

// Options
program
  .option('--dry-run')
  .option('--since <time>');
program.parse();
const options = program.opts();

/** @type {string} */
const privateKey = process.env.NOSTR_PRIVATE_KEY;
const seckey = privateKey.startsWith('nsec') ? nip19.decode(privateKey).data : privateKey;
const pubkey = getPublicKey(seckey);
console.log('[pubkey]', pubkey);

const readRelays = [...relays, readonlyRelays];

const contactsPool = new SimplePool();

const contactsEvents = await contactsPool.list(relays, [
  {
    kinds: [Kind.Contacts],
    authors: [pubkey]
  }
]);
contactsEvents.sort((x, y) => y.created_at - x.created_at);
console.log('[contacts]', contactsEvents.map(x => `${new Date(x.created_at * 1000)}: ${x.tags.length}`));

if (contactsEvents.length === 0) {
  throw new Error('Contacts not found');
}

const contactsEvent = contactsEvents[0];
const since = options.since === undefined ? contactsEvent.created_at : Math.floor(new Date(options.since).getTime() / 1000);
const followees = contactsEvent.tags.map(([,pubkey]) => pubkey);
console.log('[since]', new Date(since * 1000).toString());

const randomFollowees = Array.from({length: 100}, (v, k) => followees[Math.floor(Math.random() * followees.length)]);

const metadataPool = new SimplePool({ eoseSubTimeout: 60000 });
const followerEvents = await metadataPool.list(readRelays, [
  {
    kinds: [Kind.Contacts],
    '#p': [pubkey]
  }
]);
const unfollowedFollowers = [...new Set(
  followerEvents
    .filter(event => !followees.some(p => p === event.pubkey))
    .map(event => event.pubkey)
)];
console.log('[unfollowed followers]', unfollowedFollowers.length);
/** @type {import('nostr-tools').Filter} */
const filters = [
  {
    kinds: [Kind.Metadata],
    since
  },
  {
    kinds: [Kind.Metadata],
    authors: [...unfollowedFollowers, ...randomFollowees]
  }
];
const metadataEvents = await metadataPool.list(readRelays, filters);
metadataPool.close(readRelays);
console.log('[metadata]', metadataEvents.length);

const japaneseMetadataEvents = metadataEvents
  .filter(event =>
    /[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]/u.test(
      event.content.replace(/[、。，．「」《》]/ug, '')
    )
  );

console.log('[japanese]', japaneseMetadataEvents.length, japaneseMetadataEvents.map(x => {
  const { display_name, name, about } = JSON.parse(x.content);
  return `${isProxy(x) ? '[proxy] ' : ''}${display_name} (@${name}): ${about?.split('\n')[0]}`;
}));

const japanesePubkeys = japaneseMetadataEvents.filter(event => !isProxy(event)).map(x => x.pubkey);
const proxyPubkeys = japaneseMetadataEvents.filter(event => isProxy(event)).map(event => event.pubkey);

if (japanesePubkeys.length === 0 && !proxyPubkeys.some(pubkey => followees.some(p => p === pubkey))) {
  console.log('[no diff]');
  process.exit();
}

const pubkeys = new Set([
  ...followees.filter(pubkey => !proxyPubkeys.some(p => p === pubkey)),
  ...japanesePubkeys
]);
console.log('[contacts]', pubkeys.size);

const event = {
  kind: Kind.Contacts,
  pubkey,
  created_at: Math.floor(Date.now() / 1000),
  tags: Array.from(pubkeys).map(pubkey => ['p', pubkey]),
  content: contactsEvent.content
};
event.id = getEventHash(event);
event.sig = signEvent(event, seckey);

await fs.writeFile('docs/contacts.json', JSON.stringify(event, null, 2));

if (options.dryRun) {
  console.log('Skip publishing.');
  process.exit();
}

const start = Date.now();
const pub = contactsPool.publish(relays, event);
pub.on('ok', relay => {
  console.log('[ok]', relay, `${Date.now() - start}ms`);
});
pub.on('failed', relay => {
  console.log('[failed]', relay, `${Date.now() - start}ms`);
});
setTimeout(() => contactsPool.close(relays), 3000);
