import assert from "node:assert/strict";
import { newId } from "../src/ids.js";
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
assert.equal(newId({ randomUUID: () => "native-id" }), "native-id");
let counter = 0;
const phoneCrypto = {
  getRandomValues(bytes) {
    for (let i = 0; i < bytes.length; i++) bytes[i] = counter++ % 256;
    return bytes;
  },
};
const first = newId(phoneCrypto),
  second = newId(phoneCrypto);
assert.match(first, uuid);
assert.match(second, uuid);
assert.notEqual(first, second);
assert.match(newId({}), uuid);
assert.match(newId(null), uuid);
console.log(
  "Passed: native IDs, local HTTP phone fallback without randomUUID, uniqueness and UUID format.",
);
