import { SimplePool } from "nostr-tools";

run();

const relays = [
    'wss://relay.nostr.band',
    'wss://relay.damus.io',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.nostr.wirednet.jp',
];

async function run() {
    const pool = new SimplePool();
    const events = await pool.list(relays, [
        {
            kinds: [0]
        }
    ]);
    console.log(events);
}
