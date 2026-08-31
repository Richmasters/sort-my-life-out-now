package com.richmasters.finevolume

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build

/**
 * Reports what this device will actually let us do. The interesting question — can we
 * attach an effect to the global mix — cannot be answered from documentation, because
 * the answer varies by OEM, Android version and output route. So we ask the device.
 *
 * The verdict goes first and in plain words. An earlier version led with the attach log,
 * where a failed first attempt followed by a successful fallback read as total failure.
 */
object Diagnostics {

    fun report(context: Context, engine: VolumeEngine): String = buildString {
        val audioManager = context.getSystemService(AudioManager::class.java)
        val ladder = engine.ladder()
        val fineGain = engine.fineGain

        appendLine("=========================================")
        appendLine(" VERDICT")
        appendLine("=========================================")
        when (fineGain.backend) {
            FineGain.Backend.NONE -> {
                appendLine("  100-step control:  NOT AVAILABLE")
                appendLine()
                appendLine("  Nothing could attach to the global mix, so the slider")
                appendLine("  quantises to the ${ladder.steps} hardware steps below.")
            }
            FineGain.Backend.DYNAMICS_PROCESSING -> {
                appendLine("  100-step control:  WORKING")
                appendLine("  Gain stage:        DynamicsProcessing (exact, flat)")
            }
            FineGain.Backend.EQUALIZER -> {
                appendLine("  100-step control:  WORKING")
                appendLine("  Gain stage:        Equalizer (approximate)")
                appendLine()
                appendLine("  Uniform band levels are only roughly flat — overlapping")
                appendLine("  filters sum, so realised attenuation tends to exceed the")
                appendLine("  requested figure, with mild tonal colouring. Steps stay")
                appendLine("  in order and far finer than the hardware ladder.")
            }
        }
        appendLine()

        appendLine("DEVICE")
        appendLine("  ${Build.MANUFACTURER} ${Build.MODEL}")
        appendLine("  Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
        appendLine()

        appendLine("OUTPUT ROUTE")
        appendLine("  ${describeDeviceType(ladder.deviceType)}  [${ladder.deviceName}]")
        appendLine()

        appendLine("HARDWARE LADDER (what Android gives us on its own)")
        appendLine("  index range: ${ladder.minIndex}..${ladder.maxIndex}  (${ladder.steps} usable steps)")
        appendLine("  current index: ${audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)}")
        val worstGap = ladder.worstGapDb()
        appendLine("  biggest jump between steps: ${fmt(worstGap)} dB")
        appendLine()
        for (i in ladder.minIndex..ladder.maxIndex) {
            val db = ladder.db[i]
            val label = when {
                db.isNaN() -> "unavailable"
                db.isInfinite() -> "silent"
                else -> "${fmt(db)} dB"
            }
            appendLine("    [%2d]  %s".format(i, label))
        }
        appendLine()

        if (fineGain.backend != FineGain.Backend.NONE) {
            appendLine("FINE STAGE CALIBRATION")
            if (fineGain.isFlat) {
                appendLine("  not needed — this backend is exact")
            } else {
                appendLine("  delivering %.2f dB per 1 dB requested".format(fineGain.gainScale))
                appendLine("  usable trim: %.1f dB".format(fineGain.usableMinGainDb))
                if (fineGain.gainScale == 1f) {
                    appendLine("  (assumed, not measured — run Calibrate)")
                }
            }
            appendLine()
        }

        if (fineGain.backend != FineGain.Backend.NONE) {
            appendLine("MEASURED RESOLUTION OF THE FINE STAGE")
            val probe = fineGain.probeResolution()
            if (probe == null) {
                appendLine("  probe failed")
            } else {
                appendLine("  smallest real step: %.2f dB".format(probe.smallestStepDb))
                appendLine("  ${probe.note}")
                appendLine()
                appendLine("  requested -> stored (millibels)")
                probe.samples.take(12).forEach { (requested, stored) ->
                    appendLine("    %5d -> %5d".format(requested, stored))
                }
            }
            appendLine()
        }

        appendLine("RESULTING RESOLUTION")
        val (floor, ceiling) = engine.rangeDb(ladder)
        appendLine("  slider range: ${fmt(floor)} dB .. ${fmt(ceiling)} dB")
        if (fineGain.backend != FineGain.Backend.NONE) {
            appendLine("  ${VolumeEngine.POSITIONS} steps of ${fmt(engine.stepSizeDb(ladder))} dB each")
            appendLine("  (1 dB is roughly the smallest change most people notice,")
            appendLine("   so anything at or under that is as fine as is useful)")
        } else {
            appendLine("  ${ladder.steps} steps of ~${fmt(worstGap)} dB — unchanged from stock")
        }
        appendLine()

        appendLine("ATTACH ATTEMPTS")
        appendLine("  Backends are tried best-first. Failures above a success are")
        appendLine("  expected and harmless — only the last line matters.")
        appendLine()
        if (fineGain.attempts.isEmpty()) {
            appendLine("  (none recorded)")
        } else {
            fineGain.attempts.forEach { attempt ->
                appendLine("  ${if (attempt.succeeded) "OK  " else "fail"}  ${attempt.name}")
                appendLine("        ${attempt.detail}")
            }
        }
        appendLine()

        if (fineGain.backend == FineGain.Backend.NONE) {
            appendLine("IF NOTHING ATTACHED, TRY")
            appendLine("  Developer options > Disable Bluetooth A2DP hardware offload (needs reboot)")
            appendLine("  Developer options > Disable absolute volume")
            appendLine("  then tap 'Re-attach and refresh'.")
        }
    }

    private fun describeDeviceType(type: Int): String = when (type) {
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "Bluetooth A2DP"
        AudioDeviceInfo.TYPE_BLE_HEADSET -> "Bluetooth LE headset"
        AudioDeviceInfo.TYPE_BLE_SPEAKER -> "Bluetooth LE speaker"
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "Bluetooth SCO"
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "phone speaker"
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "wired headphones"
        AudioDeviceInfo.TYPE_WIRED_HEADSET -> "wired headset"
        AudioDeviceInfo.TYPE_USB_HEADSET -> "USB headset"
        AudioDeviceInfo.TYPE_USB_DEVICE -> "USB audio device"
        else -> "type $type"
    }

    private fun fmt(value: Float): String =
        if (value.isFinite()) "%.1f".format(value) else value.toString()
}
