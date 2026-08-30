package com.richmasters.finevolume

import android.accessibilityservice.AccessibilityService
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent

/**
 * Swallows the volume rocker and applies our own one-percent step instead of Android's
 * ~7%. This is the part that makes the whole thing feel right day to day — you stop
 * reaching for the app at all.
 *
 * Consuming the keys means the system volume UI never appears, which is deliberate: the
 * notification shows the real figure, and the system panel would only ever show the
 * coarse hardware index and contradict us.
 */
class VolumeKeyService : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        VolumeController.init(this)
    }

    override fun onKeyEvent(event: KeyEvent): Boolean {
        val delta = when (event.keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP -> +1
            KeyEvent.KEYCODE_VOLUME_DOWN -> -1
            else -> return false
        }

        // Act on the press, swallow the release, and let long-press repeats through so
        // holding the rocker still ramps.
        if (event.action == KeyEvent.ACTION_DOWN) {
            VolumeController.nudge(delta)
        }
        return true
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

    override fun onInterrupt() = Unit
}
