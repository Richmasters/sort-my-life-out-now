package com.richmasters.finevolume

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build

/**
 * Reports what this device will actually let us do. The interesting question — can we
 * attach an effect to the global mix — cannot be answered from documentation, because the
 * answer varies by OEM, Android version, and output route. So we ask the device.
 *
 * Note that a successful attach is necessary but not sufficient: with Bluetooth A2DP
 * hardware offload active, the effect attaches happily and then does nothing, because the
 * audio never passes through the software mixer. Only the audible test settles that.
 */
object Diagnostics {

    fun report(context: Context, engine: VolumeEngine): String = buildString {
        val audioManager = context.getSystemService(AudioManager::class.java)
        val ladder = engine.ladder()

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

        appendLine("FINE GAIN STAGE (session 0 — the thing that buys us 100 steps)")
        engine.fineGain.attachLog.lines().forEach { appendLine("  $it") }
        appendLine()
        when (engine.fineGain.backend) {
            FineGain.Backend.NONE -> {
                appendLine("  RESULT: no backend attached.")
                appendLine("  Nothing can subdivide the hardware steps. On a stock Pixel this is")
                appendLine("  expected — session 0 is gated behind MODIFY_AUDIO_SETTINGS_PRIVILEGED,")
                appendLine("  a signature-level permission that cannot be granted by ADB or a toggle.")
                appendLine("  The slider still works, but it quantises to the ${ladder.steps} steps above.")
            }
            else -> {
                appendLine("  RESULT: ${engine.fineGain.backend} attached, down to ${fmt(engine.fineGain.minGainDb)} dB.")
                appendLine("  Attaching is not proof it is audible — run the audible test below.")
            }
        }
        appendLine()

        appendLine("RESULTING RESOLUTION")
        val (floor, ceiling) = engine.rangeDb(ladder)
        appendLine("  slider range: ${fmt(floor)} dB .. ${fmt(ceiling)} dB")
        if (engine.fineGain.backend != FineGain.Backend.NONE) {
            appendLine("  ${VolumeEngine.POSITIONS} steps of ${fmt(engine.stepSizeDb(ladder))} dB each")
            appendLine("  (1 dB is roughly the smallest change most people notice)")
        } else {
            appendLine("  ${ladder.steps} steps of ~${fmt(worstGap)} dB — unchanged from stock")
        }
        appendLine()

        appendLine("IF THE FINE STAGE FAILED, TRY")
        appendLine("  Developer options > Disable Bluetooth A2DP hardware offload (needs reboot)")
        appendLine("  Developer options > Disable absolute volume")
        appendLine("  then reopen this screen.")
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
