package com.richmasters.finevolume

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build

/**
 * Turns a 0..100 position into an actual output level.
 *
 * Android gives us a coarse hardware ladder — typically 15 steps spread over ~55 dB,
 * so about 4 dB a press, which is why the stock control always overshoots the spot you
 * wanted. This class stacks two gain stages to get real resolution:
 *
 *   coarse  the hardware index, via AudioManager.setStreamVolume
 *   fine    a software attenuation on the global mix, via [FineGain]
 *
 * The obvious mapping — take the lowest hardware step at or above the target and trim
 * the rest — moves the hardware index at every step, so the trim snaps back to zero at
 * every hardware boundary. Any error in the fine stage then shows up as a lurch at each
 * of those boundaries, which is the original problem rebuilt in miniature.
 *
 * So instead the hardware index is held still and the fine stage does the moving. A step
 * is chosen to sit roughly mid-range of the available trim, giving headroom in both
 * directions, and is kept until the trim runs out of room. With ~2.3 dB hardware steps
 * and 15 dB of trim, boundaries become several times rarer and land well away from
 * wherever you happen to be adjusting.
 *
 * If the fine stage is unavailable we fall back to picking the nearest hardware step,
 * which is no better than stock but no worse either — and notably not biased loud, which
 * ceiling-only selection would be.
 *
 * The dB figures are not assumed. getStreamVolumeDb reports what each index is actually
 * worth on this device for the output route in use, so the mapping is measured, not
 * guessed — and it changes when you move between speaker and headphones.
 */
class VolumeEngine(context: Context) {

    private val audioManager = context.getSystemService(AudioManager::class.java)
    val fineGain = FineGain()

    /**
     * The quietest level the slider will reach, in dB. Deliberately not the device floor:
     * spending slider travel on levels far below anything audible wastes the resolution we
     * just went to such trouble to obtain. Clamped to the device's real floor in [ladder].
     */
    var floorDbPreference: Float = -45f

    /** The hardware step currently held, and the route it was chosen for. */
    private var heldIndex: Int = -1
    private var heldDeviceType: Int = Int.MIN_VALUE

    data class Ladder(
        val minIndex: Int,
        val maxIndex: Int,
        /** dB per hardware index, indexed from 0. NEGATIVE_INFINITY where muted. */
        val db: FloatArray,
        val deviceType: Int,
        val deviceName: String
    ) {
        val steps: Int get() = maxIndex - minIndex
        val topDb: Float get() = db[maxIndex]

        /** The largest gap between adjacent audible steps — the size of the jump you feel. */
        fun worstGapDb(): Float {
            var worst = 0f
            for (i in (minIndex + 1)..maxIndex) {
                val lo = db[i - 1]
                val hi = db[i]
                if (lo.isFinite() && hi.isFinite()) worst = maxOf(worst, hi - lo)
            }
            return worst
        }
    }

    data class Applied(
        val position: Int,
        val targetDb: Float,
        val hardwareIndex: Int,
        val hardwareDb: Float,
        val trimDb: Float,
        val trimApplied: Boolean
    )

    fun activeOutputDevice(): AudioDeviceInfo? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
            runCatching { audioManager.getAudioDevicesForAttributes(attrs) }
                .getOrNull()
                ?.firstOrNull()
                ?.let { return it }
        }
        // Older devices, or the query failed: guess by preference order instead.
        val outputs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
        val preference = listOf(
            AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
            AudioDeviceInfo.TYPE_BLE_HEADSET,
            AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
            AudioDeviceInfo.TYPE_WIRED_HEADSET,
            AudioDeviceInfo.TYPE_USB_HEADSET,
            AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
        )
        for (type in preference) {
            outputs.firstOrNull { it.type == type }?.let { return it }
        }
        return outputs.firstOrNull()
    }

    fun ladder(): Ladder {
        val device = activeOutputDevice()
        val deviceType = device?.type ?: AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
        val minIndex = audioManager.getStreamMinVolume(AudioManager.STREAM_MUSIC)
        val maxIndex = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)

        val db = FloatArray(maxIndex + 1) { index ->
            runCatching {
                audioManager.getStreamVolumeDb(AudioManager.STREAM_MUSIC, index, deviceType)
            }.getOrDefault(Float.NaN)
        }

        return Ladder(
            minIndex = minIndex,
            maxIndex = maxIndex,
            db = db,
            deviceType = deviceType,
            deviceName = device?.productName?.toString() ?: "unknown"
        )
    }

    /** The lowest audible step's dB, used as the hard floor for the slider range. */
    private fun deviceFloorDb(ladder: Ladder): Float {
        for (i in (ladder.minIndex + 1)..ladder.maxIndex) {
            if (ladder.db[i].isFinite()) return ladder.db[i]
        }
        return -60f
    }

    fun rangeDb(ladder: Ladder): Pair<Float, Float> {
        val hardFloor = deviceFloorDb(ladder)
        val floor = maxOf(hardFloor, floorDbPreference)
        val ceiling = if (ladder.topDb.isFinite()) ladder.topDb else 0f
        return floor to ceiling
    }

    fun targetDbFor(position: Int, ladder: Ladder): Float {
        val (floor, ceiling) = rangeDb(ladder)
        val p = position.coerceIn(1, POSITIONS)
        return floor + (ceiling - floor) * ((p - 1).toFloat() / (POSITIONS - 1))
    }

    /** Effective resolution in dB per slider step, given the current range. */
    fun stepSizeDb(ladder: Ladder): Float {
        val (floor, ceiling) = rangeDb(ladder)
        return (ceiling - floor) / (POSITIONS - 1)
    }

    fun apply(position: Int): Applied {
        val ladder = ladder()

        if (position <= 0) {
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, ladder.minIndex, 0)
            fineGain.setGainDb(0f)
            return Applied(0, Float.NEGATIVE_INFINITY, ladder.minIndex, Float.NEGATIVE_INFINITY, 0f, false)
        }

        val targetDb = targetDbFor(position, ladder)
        val canTrim = fineGain.backend != FineGain.Backend.NONE

        val previousIndex = heldIndex
        val index = if (canTrim) {
            heldIndexFor(targetDb, ladder)
        } else {
            nearestIndex(targetDb, ladder)
        }
        heldIndex = index
        heldDeviceType = ladder.deviceType

        val hardwareDb = ladder.db[index]
        val trim = if (canTrim && hardwareDb.isFinite()) targetDb - hardwareDb else 0f

        // Order matters when the hardware step moves. Raising the hardware index before
        // the trim lands puts a brief spike of full-level audio into your ears; doing it
        // the other way round costs only a brief dip. So whichever change makes things
        // quieter goes first.
        val steppingUp = previousIndex in ladder.db.indices &&
            index != previousIndex &&
            ladder.db[index] > ladder.db[previousIndex]

        val trimApplied: Boolean
        if (steppingUp) {
            trimApplied = if (canTrim) fineGain.setGainDb(trim) else false
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, index, 0)
        } else {
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, index, 0)
            trimApplied = if (canTrim) fineGain.setGainDb(trim) else false
        }

        return Applied(
            position = position,
            targetDb = targetDb,
            hardwareIndex = index,
            hardwareDb = hardwareDb,
            trimDb = trim,
            trimApplied = trimApplied
        )
    }

    /**
     * Keep the hardware step we are on for as long as the fine stage can still reach the
     * target from it. Only when the trim runs out of room do we move, and then we move to
     * a step that leaves the target near the middle of the trim range so the next move is
     * as far away as possible in either direction.
     */
    private fun heldIndexFor(targetDb: Float, ladder: Ladder): Int {
        val usableMin = fineGain.usableMinGainDb

        if (heldDeviceType == ladder.deviceType && heldIndex in (ladder.minIndex + 1)..ladder.maxIndex) {
            val db = ladder.db[heldIndex]
            if (db.isFinite()) {
                val trim = targetDb - db
                if (trim <= 0f && trim >= usableMin) return heldIndex
            }
        }

        // Aim for a step sitting half the usable trim above the target.
        val idealDb = targetDb - usableMin / 2f
        var best = -1
        var bestDistance = Float.MAX_VALUE
        for (i in (ladder.minIndex + 1)..ladder.maxIndex) {
            val db = ladder.db[i]
            if (!db.isFinite() || db < targetDb) continue
            val distance = kotlin.math.abs(db - idealDb)
            if (distance < bestDistance) {
                bestDistance = distance
                best = i
            }
        }
        return if (best >= 0) best else ladder.maxIndex
    }

    private fun nearestIndex(targetDb: Float, ladder: Ladder): Int {
        var best = ladder.maxIndex
        var bestDistance = Float.MAX_VALUE
        for (i in (ladder.minIndex + 1)..ladder.maxIndex) {
            val db = ladder.db[i]
            if (!db.isFinite()) continue
            val distance = kotlin.math.abs(db - targetDb)
            if (distance < bestDistance) {
                bestDistance = distance
                best = i
            }
        }
        return best
    }

    /**
     * Two hardware steps roughly [targetGapDb] apart, whose exact separation we know from
     * getStreamVolumeDb. Calibration asks the fine stage to bridge that known gap and
     * compares by ear, which turns an unmeasurable question into an audible one.
     * Returns louder step to quieter step, or null if the ladder is too coarse.
     */
    fun calibrationPair(ladder: Ladder, targetGapDb: Float = 6f): Pair<Int, Int>? {
        var best: Pair<Int, Int>? = null
        var bestError = Float.MAX_VALUE
        for (louder in (ladder.minIndex + 1)..ladder.maxIndex) {
            for (quieter in (ladder.minIndex + 1) until louder) {
                val a = ladder.db[louder]
                val b = ladder.db[quieter]
                if (!a.isFinite() || !b.isFinite()) continue
                val error = kotlin.math.abs((a - b) - targetGapDb)
                if (error < bestError) {
                    bestError = error
                    best = louder to quieter
                }
            }
        }
        return best
    }

    /** Calibration only: drive both stages directly, bypassing the mapping. */
    fun applyRawForCalibration(index: Int, rawTrimDb: Float) {
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, index, 0)
        fineGain.setRawGainDb(rawTrimDb)
    }

    /** Best-effort read of where the slider should sit, from the current hardware index. */
    fun positionFromHardware(): Int {
        val ladder = ladder()
        val index = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        if (index <= ladder.minIndex) return 0
        val db = ladder.db.getOrNull(index) ?: return 50
        if (!db.isFinite()) return 0
        val (floor, ceiling) = rangeDb(ladder)
        if (ceiling <= floor) return 50
        val fraction = ((db - floor) / (ceiling - floor)).coerceIn(0f, 1f)
        return (fraction * (POSITIONS - 1)).toInt() + 1
    }

    companion object {
        /** The whole point of the exercise. */
        const val POSITIONS = 100
    }
}
