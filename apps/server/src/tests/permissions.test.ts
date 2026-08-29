import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../utils/argon2.js';
import { PermissionFlags, hasPermission, computeCombinedPermissions } from '@gdisc/shared';

test('Security & Cryptography - Argon2id Password Hashing', async () => {
  const plainPassword = 'SuperSecret123!';
  const hash = await hashPassword(plainPassword);

  assert.ok(hash.startsWith('$argon2id$'), 'Hash should use Argon2id variant');

  const isValid = await verifyPassword(hash, plainPassword);
  assert.equal(isValid, true, 'Correct password should verify');

  const isInvalid = await verifyPassword(hash, 'WrongPassword');
  assert.equal(isInvalid, false, 'Incorrect password should fail verification');
});

test('Authorization - Bitwise Permissions System', () => {
  // Test individual permission check
  const memberPerms = PermissionFlags.SEND_MESSAGES | PermissionFlags.VIEW_CHANNEL;
  assert.equal(hasPermission(memberPerms, PermissionFlags.SEND_MESSAGES), true);
  assert.equal(hasPermission(memberPerms, PermissionFlags.VIEW_CHANNEL), true);
  assert.equal(hasPermission(memberPerms, PermissionFlags.ADMINISTRATOR), false);
  assert.equal(hasPermission(memberPerms, PermissionFlags.MANAGE_SERVER), false);

  // Test Administrator Bypass
  const adminPerms = PermissionFlags.ADMINISTRATOR;
  assert.equal(hasPermission(adminPerms, PermissionFlags.MANAGE_SERVER), true);
  assert.equal(hasPermission(adminPerms, PermissionFlags.KICK_MEMBERS), true);
  assert.equal(hasPermission(adminPerms, PermissionFlags.BAN_MEMBERS), true);
  assert.equal(hasPermission(adminPerms, PermissionFlags.MANAGE_MESSAGES), true);
  assert.equal(hasPermission(adminPerms, PermissionFlags.SCREEN_SHARE), true);

  // Test Combined Roles
  const roleA = PermissionFlags.VIEW_CHANNEL | PermissionFlags.SEND_MESSAGES;
  const roleB = PermissionFlags.CONNECT_VOICE | PermissionFlags.SPEAK;
  const combined = computeCombinedPermissions([roleA, roleB]);

  assert.equal(hasPermission(combined, PermissionFlags.VIEW_CHANNEL), true);
  assert.equal(hasPermission(combined, PermissionFlags.SPEAK), true);
  assert.equal(hasPermission(combined, PermissionFlags.MANAGE_CHANNELS), false);
});
