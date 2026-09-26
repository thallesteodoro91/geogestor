import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readSharedDataNoticePreference,
  sharedDataNoticeStorageKey,
  writeSharedDataNoticePreference
} from './sharedDataNoticePreference';

test('preferência do aviso compartilhado é isolada por contexto e reversível', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };

  writeSharedDataNoticePreference('project-shared-data', true, storage);
  assert.equal(readSharedDataNoticePreference('project-shared-data', storage), true);
  assert.equal(readSharedDataNoticePreference('client-finance-shared-data', storage), false);
  assert.equal(values.get(sharedDataNoticeStorageKey('project-shared-data')), 'hidden');

  writeSharedDataNoticePreference('project-shared-data', false, storage);
  assert.equal(readSharedDataNoticePreference('project-shared-data', storage), false);
});
