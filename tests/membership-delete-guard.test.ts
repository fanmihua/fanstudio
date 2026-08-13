import assert from "node:assert/strict"
import {
  DANGER_DELETE_CONFIRM_TEXT,
  buildDangerDeleteMessage,
  isDangerDeleteConfirmed,
} from "../src/lib/admin-delete-guard"

assert.equal(DANGER_DELETE_CONFIRM_TEXT, "确认删除")
assert.equal(isDangerDeleteConfirmed({ confirmText: "确认删除" }), true)
assert.equal(isDangerDeleteConfirmed({ confirmText: " 删除 " }), false)
assert.equal(isDangerDeleteConfirmed({ confirmText: "CONFIRM" }), false)
assert.equal(isDangerDeleteConfirmed(null), false)

const message = buildDangerDeleteMessage("会员订单", "MBR123")
assert.match(message, /会员订单/)
assert.match(message, /MBR123/)
assert.match(message, /不可恢复/)
assert.match(message, /上线后/)

console.log("membership delete guard tests passed")
