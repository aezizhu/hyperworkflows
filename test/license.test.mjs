import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LICENSE = readFileSync(join(ROOT, "LICENSE"), "utf8");

// Canonical MIT License body (SPDX / choosealicense.com), with {year}/{holder}
// placeholders. This golden template is the oracle: the LICENSE file must be a
// byte-exact MIT license so no clause can drift or be silently weakened.
const MIT_TEMPLATE = `MIT License

Copyright (c) {year} {holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

test("LICENSE: copyright line is well-formed (year + non-empty holder)", () => {
  const m = LICENSE.match(/^Copyright \(c\) (\d{4}) (.+)$/m);
  assert.ok(m, "copyright line must match 'Copyright (c) <year> <holder>'");
  const year = Number(m[1]);
  assert.ok(year >= 2020 && year <= 2100, `implausible copyright year: ${m[1]}`);
  assert.ok(m[2].trim().length > 0, "copyright holder must be non-empty");
});

test("LICENSE: byte-exact match against canonical MIT template", () => {
  const m = LICENSE.match(/^Copyright \(c\) (\d{4}) (.+)$/m);
  const expected = MIT_TEMPLATE
    .replace("{year}", m[1])
    .replace("{holder}", m[2]);
  // Byte-exact: catches any tampering, clause removal, or whitespace drift.
  assert.equal(LICENSE, expected);
});

test("LICENSE: matches the license declared in package.json", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.license, "MIT");
  assert.equal(LICENSE.split("\n", 1)[0], "MIT License");
});

test("LICENSE: ends with exactly one trailing newline", () => {
  assert.ok(LICENSE.endsWith("SOFTWARE.\n"));
  assert.ok(!LICENSE.endsWith("SOFTWARE.\n\n"));
});
