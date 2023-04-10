import 'websocket-polyfill';
import { SimplePool, Kind, getPublicKey, nip19, getEventHash, signEvent } from 'nostr-tools';

/** @type {string} */
const privateKey = process.env.NOSTR_PRIVATE_KEY;
const seckey = privateKey.startsWith('nsec') ? nip19.decode(privateKey).data : privateKey;
const pubkey = getPublicKey(seckey);
console.log('[pubkey]', pubkey);

const relays = [
  'wss://relay.nostr.band',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.nostr.wirednet.jp',
];

const contactsPool = new SimplePool();

const contactsEvents = await contactsPool.list(relays, [
  {
    kinds: [Kind.Contacts],
    authors: [pubkey]
  }
]);
contactsEvents.sort((x, y) => x.created_at - y.created_at);
console.log('[contacts]', JSON.stringify(contactsEvents, null, 2));

if (contactsEvents.length === 0) {
  throw new Error('Contacts not found');
}

const contactsEvent = contactsEvents[0];

const metadataPool = new SimplePool({ eoseSubTimeout: 60000 });
const metadataEvents = await metadataPool.list(relays, [
  {
    kinds: [Kind.Metadata],
    since: contactsEvent.created_at
  }
]);
metadataPool.close(relays);
console.log('[metadata]', metadataEvents.length);

const japaneseMetadataEvents = metadataEvents
  .filter(event => /[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]/u.test(
    event.content.replace(/[、。，．「」]/ug, '')
  ));

console.log('[japanese]', japaneseMetadataEvents.length, japaneseMetadataEvents.map(x => {
  const { display_name, name, about } = JSON.parse(x.content);
  return `${display_name} (@${name}): ${about}`;
}));

if (japaneseMetadataEvents.length === 0) {
  console.log('[no users]');
  process.exit(0);
}

const pubkeys = new Set([
  ...contactsEvent.tags.map(([,pubkey]) => pubkey),
  ...japaneseMetadataEvents.map(x => x.pubkey)
]);
const event = {
  kind: Kind.Contacts,
  pubkey,
  created_at: Math.floor(Date.now() / 1000),
  tags: Array.from(pubkeys).map(pubkey => ['p', pubkey]),
  content: contactsEvent.content
};
event.id = getEventHash(event);
event.sig = signEvent(event, seckey);
console.log('[publish]', event);

const pub = contactsPool.publish(relays, event);
pub.on('ok', relay => {
  console.log('[ok]', relay);
});
pub.on('failed', relay => {
  console.log('[failed]', relay);
});
setTimeout(() => contactsPool.close(relays), 3000);
