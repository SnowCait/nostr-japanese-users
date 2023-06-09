import 'websocket-polyfill';
import * as fs from 'fs/promises';
import { SimplePool, Kind, getPublicKey, nip19, getEventHash, signEvent } from 'nostr-tools';
import relays from './relays.json' assert { type: 'json' };
import readonlyRelays from './relays.readonly.json' assert { type: 'json' };
import dotenv from 'dotenv';
dotenv.config();

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

const metadataPool = new SimplePool({ eoseSubTimeout: 60000 });
const metadataEvents = await metadataPool.list(readRelays, [
  {
    kinds: [Kind.Metadata],
    since: contactsEvent.created_at
  }
]);
metadataPool.close(readRelays);
console.log('[metadata]', metadataEvents.length);

const japaneseMetadataEvents = metadataEvents
  .filter(event =>
    !event.tags.some(([tagName]) => tagName === 'mostr') &&
    /[\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}]/u.test(
      event.content.replace(/[、。，．「」《》]/ug, '')
    )
  );

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
console.log('[contacts]', pubkeys.size);

if (pubkeys.size <= contactsEvent.tags.length) {
  console.log('[no new users]');
  process.exit(0);
}

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

const start = Date.now();
const pub = contactsPool.publish(relays, event);
pub.on('ok', relay => {
  console.log('[ok]', relay, `${Date.now() - start}ms`);
});
pub.on('failed', relay => {
  console.log('[failed]', relay, `${Date.now() - start}ms`);
});
setTimeout(() => contactsPool.close(relays), 3000);
