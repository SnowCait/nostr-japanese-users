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

const readRelays = [...relays, ...readonlyRelays];

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
const followees = contactsEvent.tags.map(([, pubkey]) => pubkey);
console.log('[since]', new Date(since * 1000).toString());

const randomFollowees = Array.from({ length: 10 }, (v, k) => followees[Math.floor(Math.random() * followees.length)]);

const readPool = new SimplePool({ eoseSubTimeout: 60000 });

const anyEvents = await readPool.list(readRelays, since7daysAgoFilters(randomFollowees));
const inactiveFollowees = randomFollowees.filter(p => !anyEvents.some(event => event.pubkey === p));
console.log('[inactive]', inactiveFollowees, inactiveFollowees.length);

const followerEvents = await readPool.list(readRelays, [
  {
    kinds: [Kind.Contacts],
    '#p': [pubkey]
  }
]);
const unfollowedFollowers = [...new Set(
  followerEvents
    .filter(event => !followees.includes(event.pubkey))
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
const metadataEvents = await readPool.list(readRelays, filters);
console.log('[metadata]', metadataEvents.length);

const japaneseMetadataEvents = metadataEvents
  .filter(event => /[ぁ-ゔァ-ヺ]/u.test(event.content));

console.log('[japanese]', japaneseMetadataEvents.length, japaneseMetadataEvents.map(x => {
  try {
    const { display_name, name, about } = JSON.parse(x.content);
    return `${isProxy(x) ? '[proxy] ' : ''}${display_name} (@${name}): ${about?.split('\n')[0]}`;
  } catch (error) {
    return `${isProxy(x) ? '[proxy] ' : ''}${x.content}`;
  }
}));

const japanesePubkeys = japaneseMetadataEvents.filter(event => !isProxy(event)).map(event => event.pubkey);
const proxyPubkeys = japaneseMetadataEvents.filter(event => isProxy(event)).map(event => event.pubkey);

// NIP-56 Reporting
const reportingEvents = await readPool.list(readRelays, [
  {
    kinds: [1984],
    '#p': japaneseMetadataEvents.map(event => event.pubkey)
  }
]);
readPool.close(readRelays);

const reportedPubkeys = reportingEvents.flatMap(
  event => event.tags.filter(([tagName]) => tagName === 'p').map(([, pubkey]) => pubkey)
).reduce((map, p) => {
  const increment = 1;
  if (map.has(p)) {
    const count = map.get(p);
    map.set(p, count + increment);
  } else {
    map.set(p, increment);
  }
  return map;
}, new Map());
const manyReportedPubkeys = [...reportedPubkeys]
  .filter(([, count]) => count > 56)
  .map(([pubkey]) => pubkey);
console.log('[reported]', reportedPubkeys, manyReportedPubkeys);

if (
  japanesePubkeys.length === 0 &&
  !proxyPubkeys.some(pubkey => followees.includes(pubkey)) &&
  !manyReportedPubkeys.some(pubkey => followees.includes(pubkey))
) {
  console.log('[no diff]');
  process.exit();
}

const sleep = await fs.readFile('docs/sleep.json');
/** @type {import('nostr-tools').Event} */
const sleepEvent = JSON.parse(sleep);
const sleepers = sleepEvent.tags.filter(([tagName]) => tagName === 'p').map(([, pubkey]) => pubkey);
const randomSleepers = Array.from({ length: 10 }, (v, k) => sleepers[Math.floor(Math.random() * sleepers.length)]);

const sleepersAnyEvents = await readPool.list(readRelays, since7daysAgoFilters(randomSleepers));
const activeSleepers = [...new Set(sleepersAnyEvents.map(event => event.pubkey))];
console.log('[active]', activeSleepers, activeSleepers.length);

const pubkeys = new Set([
  ...followees.filter(
    pubkey => !proxyPubkeys.includes(pubkey) && !manyReportedPubkeys.includes(pubkey) && !inactiveFollowees.includes(pubkey)
  ),
  ...japanesePubkeys.filter(pubkey => !manyReportedPubkeys.includes(pubkey) && !inactiveFollowees.includes(pubkey)),
  ...activeSleepers
]);
console.log('[contacts]', pubkeys.size);

const now = Math.floor(Date.now() / 1000);
const event = {
  kind: Kind.Contacts,
  pubkey,
  created_at: now,
  tags: Array.from(pubkeys).map(pubkey => ['p', pubkey]),
  content: contactsEvent.content
};
event.id = getEventHash(event);
event.sig = signEvent(event, seckey);

await fs.writeFile('docs/contacts.json', JSON.stringify(event, null, 2));

sleepEvent.tags = sleepEvent.tags.filter(([, pubkey]) => !activeSleepers.includes(pubkey));
sleepEvent.tags.push(
  ...inactiveFollowees
    .map(pubkey => ['p', pubkey])
    .filter(
      pubkey => !proxyPubkeys.includes(pubkey) && !sleepEvent.tags.some(([tagName, p]) => tagName === 'p' && p === pubkey)
    )
);
sleepEvent.id = getEventHash(sleepEvent);
sleepEvent.sig = signEvent(sleepEvent, seckey);

await fs.writeFile('docs/sleep.json', JSON.stringify(sleepEvent, null, 2));

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

/**
 * @param {string[]} pubkeys
 * @returns {import('nostr-tools').Filter[]}
 */
function since7daysAgoFilters(pubkeys) {
  return pubkeys.map(p => {
    return {
      authors: [p],
      limit: 1,
      since: Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60,
    };
  })
}
