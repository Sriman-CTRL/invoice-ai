import test from "node:test";
import assert from "node:assert/strict";
import { amountInWords } from "../src/amountInWords";

test("amount in words: the specified cases", () => {
  assert.equal(amountInWords(0), "Rupees Zero Only");
  assert.equal(amountInWords(1), "Rupees One Only");
  assert.equal(amountInWords(99.5), "Rupees Ninety-Nine and Fifty Paise Only");
  assert.equal(amountInWords(100000), "Rupees One Lakh Only");
  assert.equal(amountInWords(12345678.9), "Rupees One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight and Ninety Paise Only");
  assert.equal(amountInWords(999999999), "Rupees Ninety-Nine Crore Ninety-Nine Lakh Ninety-Nine Thousand Nine Hundred Ninety-Nine Only");
  assert.equal(amountInWords(45000), "Rupees Forty-Five Thousand Only");
});

test("amount in words: teens, round hundreds, paise rounding and awkward floats", () => {
  assert.equal(amountInWords(11), "Rupees Eleven Only");
  assert.equal(amountInWords(100), "Rupees One Hundred Only");
  assert.equal(amountInWords(101.01), "Rupees One Hundred One and One Paise Only");
  assert.equal(amountInWords(0.5), "Rupees Zero and Fifty Paise Only");
  assert.equal(amountInWords(1.005 + 0.0001), "Rupees One and One Paise Only");
  assert.equal(amountInWords(19.99), "Rupees Nineteen and Ninety-Nine Paise Only");
  assert.equal(amountInWords(100000000), "Rupees Ten Crore Only");
  assert.equal(amountInWords(1000000000), "Rupees One Hundred Crore Only");
});

test("amount in words: unusable input returns null", () => {
  assert.equal(amountInWords(NaN), null);
  assert.equal(amountInWords(-5), null);
  assert.equal(amountInWords(Infinity), null);
});
