import assert from "node:assert/strict"
import { validateWechatPaidAmount } from "../src/lib/wechat-payment-amount"

assert.deepEqual(validateWechatPaidAmount(29, { total: 2900 }), { ok: true })
assert.deepEqual(validateWechatPaidAmount(3.9, { total: 390 }), { ok: true })

assert.equal(validateWechatPaidAmount(29, { total: 1 }).ok, false)
assert.equal(validateWechatPaidAmount(29, { total: 2901 }).ok, false)
assert.equal(validateWechatPaidAmount(29, undefined).ok, false)
assert.equal(validateWechatPaidAmount(29, { total: undefined }).ok, false)
assert.equal(validateWechatPaidAmount(-1, { total: -100 }).ok, false)

console.log("wechat payment amount tests passed")
