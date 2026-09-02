package com.richmasters.finevolume

import android.accessibilityservice.AccessibilityService
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import android.widget.Toast

/**
 * Swallows the volume rocker and applies our own one-percent step instead of Android's
 * much larger one.
 *
 * Consuming hardware keys is a serious thing to do: get it wrong and the user has no
 * volume control at all, with no visible cause, and the only way back is several levels
 * deep in Settings. So this service is deliberately reluctant.
 *
 *  - It never consumes a key it cannot act on. If the controller is not ready or the
 *    fine stage failed to attach, keys fall through to Android untouched.
 *  - Pressing both keys together hands control straight back, for exactly the case where
 *    something has gone wrong and Settings is not a reachable option.
 *  - Any failure applying a change disables interception rather than swallowing keys
 *    into a broken path.
 */
class VolumeKeyService : AccessibilityService() {

    private var intercepting = true
    private var otherKeyDown = false

    override fun onServiceConnected() {
        super.onServiceConnected()
        runCatching { VolumeController.init(this) }
            .onFailure { intercepting = false }
    }

    override fun onKeyEvent(event: KeyEvent): Boolean {
        val isUp = event.keyCode == KeyEvent.KEYCODE_VOLUME_UP
        val isDown = event.keyCode == KeyEvent.KEYCODE_VOLUME_DOWN
        if (!isUp && !isDown) return false

        // Both keys at once is the escape hatch: hand the rocker back to Android without
        // needing Settings, which is where you end up otherwise with no working volume.
        if (event.action == KeyEvent.ACTION_DOWN) {
            if (otherKeyDown) {
                intercepting = false
                Toast.makeText(this, "Fine Volume: keys released", Toast.LENGTH_SHORT).show()
                return false
            }
            otherKeyDown = true
        } else if (event.action == KeyEvent.ACTION_UP) {
            otherKeyDown = false
        }

        if (!intercepting || !VolumeController.isReady) return false

        if (event.action == KeyEvent.ACTION_DOWN) {
            val applied = runCatching { VolumeController.nudge(if (isUp) +1 else -1) }
            if (applied.isFailure) {
                // Never keep swallowing keys into something that is not working.
                intercepting = false
                return false
            }
        }
        return true
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

    override fun onInterrupt() {
        intercepting = false
    }

    override fun onUnbind(intent: android.content.Intent?): Boolean {
        intercepting = false
        return super.onUnbind(intent)
    }
}
