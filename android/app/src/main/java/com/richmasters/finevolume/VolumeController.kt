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
    private const val KEY_RANGE_DB = "range_db"

    private lateinit var prefs: SharedPreferences
    private var initialised = false

    /** Whether it is safe to act. Consumers must not swallow input before this is true. */
    val isReady: Boolean get() = initialised

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
        engine.floorDbPreference = -prefs.getFloat(KEY_RANGE_DB, 45f)
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

    /**
     * How many dB the hundred slider positions span. Narrowing this is the direct lever
     * on step size: the same hundred steps over less ground means finer control, at the
     * cost of the slider no longer reaching the very quiet end.
     */
    var rangeDb: Float
        get() = -engine.floorDbPreference
        set(value) {
            engine.floorDbPreference = -value
            prefs.edit().putFloat(KEY_RANGE_DB, value).apply()
            this.set(position)
        }

    val rangeOptions = listOf(10f, 15f, 20f, 30f, 45f)

    fun cycleRange() {
        val next = rangeOptions.firstOrNull { it > rangeDb + 0.5f } ?: rangeOptions.first()
        rangeDb = next
    }

    /**
     * Undo everything this app has done to the device's audio: drop the global effect,
     * and put the hardware back somewhere sensible and audible.
     *
     * Exists because the failure mode here is genuinely nasty — a global effect left
     * attenuating, or a hardware index left low, looks to the user like the phone itself
     * has broken, with no clue that this app is responsible. There must always be one
     * obvious way back that does not involve Settings.
     */
    fun panicRestore() {
        runCatching { engine.fineGain.setRawGainDb(0f) }
        runCatching { engine.fineGain.release() }
        runCatching { engine.restoreHardwareToComfortable() }
        prefs.edit().putInt(KEY_POSITION, 70).apply()
        position = 70
        listeners.toList().forEach { it(position) }
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
