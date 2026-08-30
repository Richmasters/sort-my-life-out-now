package com.richmasters.finevolume

import android.media.audiofx.DynamicsProcessing
import android.media.audiofx.Equalizer
import android.util.Log

/**
 * A software attenuation stage applied to the global output mix (audio session 0).
 * This is what fills in the gaps between Android's coarse hardware volume steps —
 * without it, a 100-step slider is a lie that snaps to the same ~15 positions.
 *
 * Two backends, tried in order:
 *  - DynamicsProcessing has a true flat input-gain stage, so -2.5 dB really is -2.5 dB.
 *  - Equalizer, all bands pinned to one level, is approximately flat. The band filters
 *    overlap so the realised attenuation drifts from the requested figure, but it is
 *    monotonic, which is enough to be useful.
 *
 * Either may fail to attach. Since Android 10, session 0 has been gated behind
 * MODIFY_AUDIO_SETTINGS_PRIVILEGED — signature-level, so not grantable via ADB or a
 * settings toggle. Attaching succeeding is also not proof it works: on a Bluetooth route
 * with A2DP hardware offload active, effects are bypassed silently. Hence [Diagnostics]
 * and its audible test.
 */
class FineGain {

    enum class Backend { NONE, DYNAMICS_PROCESSING, EQUALIZER }

    var backend: Backend = Backend.NONE
        private set

    /** Human-readable account of what happened during [attach], for the diagnostics screen. */
    var attachLog: String = "not attempted"
        private set

    /** Most negative attenuation this backend can deliver, in dB. */
    var minGainDb: Float = 0f
        private set

    private var dp: DynamicsProcessing? = null
    private var eq: Equalizer? = null
    private var bandLevelRangeMb: ShortArray? = null

    private val notes = StringBuilder()

    fun attach(): Backend {
        release()
        notes.setLength(0)

        if (tryDynamicsProcessing()) {
            backend = Backend.DYNAMICS_PROCESSING
            // DynamicsProcessing input gain has no documented floor; -40 dB is far more
            // headroom than filling a ~4 dB hardware gap ever needs.
            minGainDb = -40f
        } else if (tryEqualizer()) {
            backend = Backend.EQUALIZER
            minGainDb = (bandLevelRangeMb?.get(0)?.toFloat() ?: 0f) / 100f
        } else {
            backend = Backend.NONE
            minGainDb = 0f
        }

        attachLog = notes.toString().trimEnd()
        return backend
    }

    private fun tryDynamicsProcessing(): Boolean {
        return try {
            val config = DynamicsProcessing.Config.Builder(
                DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION,
                CHANNELS,
                /* preEqInUse = */ false, /* preEqBandCount = */ 0,
                /* mbcInUse = */ false, /* mbcBandCount = */ 0,
                /* postEqInUse = */ false, /* postEqBandCount = */ 0,
                /* limiterInUse = */ false
            ).build()

            val effect = DynamicsProcessing(EFFECT_PRIORITY, GLOBAL_SESSION, config)
            effect.setEnabled(true)
            dp = effect
            notes.append("DynamicsProcessing: attached to session 0, enabled=${effect.enabled}\n")
            true
        } catch (t: Throwable) {
            notes.append("DynamicsProcessing: FAILED — ${t.javaClass.simpleName}: ${t.message}\n")
            Log.w(TAG, "DynamicsProcessing attach failed", t)
            dp = null
            false
        }
    }

    private fun tryEqualizer(): Boolean {
        return try {
            val effect = Equalizer(EFFECT_PRIORITY, GLOBAL_SESSION)
            effect.setEnabled(true)
            bandLevelRangeMb = effect.bandLevelRange
            eq = effect
            val range = bandLevelRangeMb!!
            notes.append(
                "Equalizer: attached to session 0, enabled=${effect.enabled}, " +
                    "bands=${effect.numberOfBands}, range=${range[0]}..${range[1]} mB\n"
            )
            true
        } catch (t: Throwable) {
            notes.append("Equalizer: FAILED — ${t.javaClass.simpleName}: ${t.message}\n")
            Log.w(TAG, "Equalizer attach failed", t)
            eq = null
            false
        }
    }

    /**
     * Apply [gainDb] of attenuation (<= 0) to everything currently playing.
     * Returns false if there is no working backend, or the call was rejected.
     */
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

        /** Audio session 0 is the global output mix — everything the device is playing. */
        const val GLOBAL_SESSION = 0

        /** Effect priority; 0 is the normal value for a non-privileged app. */
        const val EFFECT_PRIORITY = 0

        const val CHANNELS = 2
    }
}
