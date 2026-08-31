package com.richmasters.finevolume

import android.content.Context
import android.content.SharedPreferences

/**
 * One engine, shared by the activity, the notification service and the volume-key
 * service — otherwise three copies would each attach their own session-0 effect and
 * fight over the hardware index.
 */
object VolumeController {

    private const val PREFS = "fine_volume"
    private const val KEY_POSITION = "position"
    private const val KEY_GAIN_SCALE = "gain_scale"

    private lateinit var prefs: SharedPreferences
    private var initialised = false

    lateinit var engine: VolumeEngine
        private set

    private val listeners = mutableSetOf<(Int) -> Unit>()

    var position: Int = 50
        private set

    @Synchronized
    fun init(context: Context) {
        if (initialised) return
        val app = context.applicationContext
        prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        engine = VolumeEngine(app)
        engine.fineGain.attach()
        engine.fineGain.gainScale = prefs.getFloat(KEY_GAIN_SCALE, 1f)
        position = prefs.getInt(KEY_POSITION, engine.positionFromHardware())
        initialised = true
    }

    /** Re-attach the fine stage, e.g. after the user changes a developer option. */
    fun reattach() {
        val scale = engine.fineGain.gainScale
        engine.fineGain.release()
        engine.fineGain.attach()
        engine.fineGain.gainScale = scale
        set(position)
    }

    /** Store the measured delivery ratio of the fine stage. See [CalibrationActivity]. */
    fun setGainScale(scale: Float) {
        val clamped = scale.coerceIn(0.25f, 4f)
        engine.fineGain.gainScale = clamped
        prefs.edit().putFloat(KEY_GAIN_SCALE, clamped).apply()
        set(position)
    }

    fun set(newPosition: Int): VolumeEngine.Applied {
        position = newPosition.coerceIn(0, VolumeEngine.POSITIONS)
        prefs.edit().putInt(KEY_POSITION, position).apply()
        val applied = engine.apply(position)
        listeners.toList().forEach { it(position) }
        return applied
    }

    fun nudge(delta: Int): VolumeEngine.Applied = set(position + delta)

    fun addListener(listener: (Int) -> Unit) {
        listeners += listener
    }

    fun removeListener(listener: (Int) -> Unit) {
        listeners -= listener
    }
}
