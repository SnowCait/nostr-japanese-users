import 'websocket-polyfill';
import { SimplePool, getPublicKey, nip19 } from 'nostr-tools';

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

const pool = new SimplePool({ eoseSubTimeout: 10000 });

const contactListEvents = await pool.list(relays, [
  {
      kinds: [3],
      authors: [pubkey]
  }
]);
contactListEvents.sort((x, y) => x.created_at - y.created_at);
console.log('[contact list]', contactListEvents);

const metadataEvents = await pool.list(relays, [
    {
        kinds: [0]
    }
]);
console.log('[metadata]', metadataEvents);
