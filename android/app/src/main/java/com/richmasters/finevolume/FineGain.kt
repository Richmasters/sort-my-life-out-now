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

    var minGainDb: Float = 0f
        private set

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

    fun setGainDb(gainDb: Float): Boolean {
        val clamped = gainDb.coerceIn(minGainDb, 0f)
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

        val DP_SHAPES = listOf(
            Shape("no stages, stereo", DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION, 2, false, 0),
            Shape("limiter on, stereo", DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION, 2, true, 0),
            Shape("post-EQ 1 band, stereo", DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION, 2, false, 1),
            Shape("limiter on, time variant", DynamicsProcessing.VARIANT_FAVOR_TIME_RESOLUTION, 2, true, 0),
            Shape("limiter on, mono", DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION, 1, true, 0)
        )
    }
}
