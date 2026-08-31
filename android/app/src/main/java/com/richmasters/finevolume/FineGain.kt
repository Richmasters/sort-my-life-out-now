package com.richmasters.finevolume

import android.media.audiofx.DynamicsProcessing
import android.media.audiofx.Equalizer
import android.util.Log

/**
 * A software attenuation stage applied to the global output mix (audio session 0).
 * This is what fills in the gaps between Android's coarse hardware volume steps —
 * without it, a 100-step slider is a lie that snaps to the same ~15 positions.
 *
 * Several backends are tried in order of quality:
 *
 *  - DynamicsProcessing has a true flat input-gain stage, so -2.5 dB really is -2.5 dB.
 *    Its config is fussy and varies by device, so we try a few shapes rather than
 *    concluding from one rejection that the device forbids it.
 *  - Equalizer with every band pinned to one level is the fallback. It is only
 *    approximately flat: the band filters overlap and sum, so the realised attenuation
 *    tends to exceed the requested figure and carries mild tonal colouring. Monotonic
 *    and far finer than the hardware ladder, which is what matters, but not exact.
 *
 * Attaching is necessary but not sufficient. With Bluetooth A2DP hardware offload
 * active the effect attaches happily and then does nothing, because the audio never
 * passes through the software mixer. Only an audible test settles it.
 */
class FineGain {

    enum class Backend { NONE, DYNAMICS_PROCESSING, EQUALIZER }

    data class Attempt(val name: String, val succeeded: Boolean, val detail: String)

    var backend: Backend = Backend.NONE
        private set

    /** Every backend shape tried, in order, for the diagnostics screen. */
    var attempts: List<Attempt> = emptyList()
        private set

    /** True flat gain, or an approximation that colours the sound slightly. */
    val isFlat: Boolean get() = backend == Backend.DYNAMICS_PROCESSING

    /** Floor on the value we may *request* from the backend, in dB. */
    var minGainDb: Float = 0f
        private set

    /**
     * How much attenuation the backend actually delivers per dB requested.
     *
     * The Equalizer backend pins every band to one level, and overlapping filters sum,
     * so asking for -3 dB does not reliably produce -3 dB. Getting that wrong is not a
     * cosmetic problem: the mapping trims relative to a known hardware step, so an error
     * here shows up as a lurch every time the hardware index moves. Measured by ear in
     * [CalibrationActivity]; 1.0 until then, and irrelevant when the backend is flat.
     */
    var gainScale: Float = 1f

    /** What we can actually deliver, after scaling. */
    val achievableMinDb: Float get() = minGainDb * gainScale

    /**
     * The span the mapping is allowed to use. Kept inside the achievable range so the
     * backend is never driven to its extreme, where linearity is least trustworthy.
     */
    val usableMinGainDb: Float get() = achievableMinDb * USABLE_FRACTION

    private var dp: DynamicsProcessing? = null
    private var eq: Equalizer? = null
    private var bandLevelRangeMb: ShortArray? = null

    fun attach(): Backend {
        release()
        val log = mutableListOf<Attempt>()

        for (shape in DP_SHAPES) {
            if (tryDynamicsProcessing(shape, log)) {
                backend = Backend.DYNAMICS_PROCESSING
                minGainDb = -40f
                attempts = log
                return backend
            }
        }

        if (tryEqualizer(log)) {
            backend = Backend.EQUALIZER
            minGainDb = (bandLevelRangeMb?.get(0)?.toFloat() ?: 0f) / 100f
            attempts = log
            return backend
        }

        backend = Backend.NONE
        minGainDb = 0f
        attempts = log
        return backend
    }

    /**
     * Config shapes to try. A config with every stage disabled is the cleanest thing to
     * ask for and works on some devices, but others reject it outright — hence the
     * variants that switch on a stage purely to make the config acceptable. The input
     * gain we actually use is independent of all of them.
     */
    private data class Shape(
        val name: String,
        val variant: Int,
        val channels: Int,
        val limiter: Boolean,
        val postEqBands: Int
    )

    private fun tryDynamicsProcessing(shape: Shape, log: MutableList<Attempt>): Boolean {
        return try {
            val config = DynamicsProcessing.Config.Builder(
                shape.variant,
                shape.channels,
                /* preEqInUse = */ false, /* preEqBandCount = */ 0,
                /* mbcInUse = */ false, /* mbcBandCount = */ 0,
                /* postEqInUse = */ shape.postEqBands > 0, shape.postEqBands,
                /* limiterInUse = */ shape.limiter
            ).build()

            val effect = DynamicsProcessing(EFFECT_PRIORITY, GLOBAL_SESSION, config)
            effect.setEnabled(true)

            // Prove the gain stage responds before trusting it; a silent no-op here is
            // worse than an exception, because it looks like success.
            effect.setInputGainAllChannelsTo(0f)

            dp = effect
            log += Attempt("DynamicsProcessing / ${shape.name}", true, "enabled=${effect.enabled}")
            true
        } catch (t: Throwable) {
            log += Attempt(
                "DynamicsProcessing / ${shape.name}",
                false,
                "${t.javaClass.simpleName}: ${t.message}"
            )
            Log.w(TAG, "DynamicsProcessing (${shape.name}) attach failed", t)
            dp = null
            false
        }
    }

    private fun tryEqualizer(log: MutableList<Attempt>): Boolean {
        return try {
            val effect = Equalizer(EFFECT_PRIORITY, GLOBAL_SESSION)
            effect.setEnabled(true)
            bandLevelRangeMb = effect.bandLevelRange
            eq = effect
            val range = bandLevelRangeMb!!
            log += Attempt(
                "Equalizer / uniform bands",
                true,
                "bands=${effect.numberOfBands}, range=${range[0]}..${range[1]} mB"
            )
            true
        } catch (t: Throwable) {
            log += Attempt("Equalizer / uniform bands", false, "${t.javaClass.simpleName}: ${t.message}")
            Log.w(TAG, "Equalizer attach failed", t)
            eq = null
            false
        }
    }

    /** [desiredDb] is the attenuation we want to hear, not the raw value sent on. */
    fun setGainDb(desiredDb: Float): Boolean = setRawGainDb(desiredDb / gainScale)

    /**
     * Send a value straight to the backend with no scale correction. Calibration needs
     * this, since it exists to discover what the scale should be.
     */
    fun setRawGainDb(rawDb: Float): Boolean {
        val clamped = rawDb.coerceIn(minGainDb, 0f)
        return try {
            when (backend) {
                Backend.DYNAMICS_PROCESSING -> {
                    dp?.setInputGainAllChannelsTo(clamped) ?: return false
                    true
                }
                Backend.EQUALIZER -> {
                    val effect = eq ?: return false
                    val levelMb = (clamped * 100f).toInt().toShort()
                    for (band in 0 until effect.numberOfBands.toInt()) {
                        effect.setBandLevel(band.toShort(), levelMb)
                    }
                    true
                }
                Backend.NONE -> false
            }
        } catch (t: Throwable) {
            Log.w(TAG, "setGainDb($clamped) failed", t)
            false
        }
    }

    data class Resolution(
        val samples: List<Pair<Int, Int>>,
        val smallestStepDb: Float,
        val note: String
    )

    /**
     * Ask the backend for a series of closely spaced values and read back what it
     * actually stored. Both backends accept fine-grained numbers, but accepting a value
     * and honouring it are different things: if the effect rounds internally, the slider
     * can claim 0.45 dB steps while the real floor is a whole decibel, and the control
     * feels coarse for reasons no amount of remapping will fix.
     *
     * Audible while it runs, so callers should restore the previous gain afterwards.
     */
    fun probeResolution(): Resolution? {
        val samples = mutableListOf<Pair<Int, Int>>()

        when (backend) {
            Backend.EQUALIZER -> {
                val effect = eq ?: return null
                for (requestMb in 0 downTo -200 step 10) {
                    runCatching {
                        effect.setBandLevel(0, requestMb.toShort())
                        samples += requestMb to effect.getBandLevel(0).toInt()
                    }
                }
            }
            Backend.DYNAMICS_PROCESSING -> {
                val effect = dp ?: return null
                for (requestMb in 0 downTo -200 step 10) {
                    runCatching {
                        effect.setInputGainAllChannelsTo(requestMb / 100f)
                        val actual = (effect.getInputGainByChannelIndex(0) * 100f).toInt()
                        samples += requestMb to actual
                    }
                }
            }
            Backend.NONE -> return null
        }

        if (samples.isEmpty()) return null

        val distinct = samples.map { it.second }.distinct().sorted()
        val smallestGap = distinct.zipWithNext { a, b -> b - a }.filter { it > 0 }.minOrNull()

        val stepDb = (smallestGap ?: 0) / 100f
        val note = when {
            distinct.size <= 1 -> "backend ignored every request — readback never changed"
            stepDb <= 0.11f -> "fine enough that the slider is the limiting factor"
            stepDb >= 0.9f -> "quantised to whole decibels — this is the real floor"
            else -> "usable, but coarser than the slider implies"
        }
        return Resolution(samples, stepDb, note)
    }

    fun release() {
        runCatching { dp?.release() }
        runCatching { eq?.release() }
        dp = null
        eq = null
        backend = Backend.NONE
    }

    private companion object {
        const val TAG = "FineGain"
        const val GLOBAL_SESSION = 0
        const val EFFECT_PRIORITY = 0

        /** Leave headroom rather than working the backend against its stops. */
        const val USABLE_FRACTION = 0.8f

        val DP_SHAPES = listOf(
            Shape("no stages, stereo", DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION, 2, false, 0),
            Shape("limiter on, stereo", DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION, 2, true, 0),
            Shape("post-EQ 1 band, stereo", DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION, 2, false, 1),
            Shape("limiter on, time variant", DynamicsProcessing.VARIANT_FAVOR_TIME_RESOLUTION, 2, true, 0),
            Shape("limiter on, mono", DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION, 1, true, 0)
        )
    }
}
