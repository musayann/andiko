// jsdom has no IndexedDB, which Dexie (store/indexeddb.ts) needs
import "fake-indexeddb/auto"
