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
        position = prefs.getInt(KEY_POSITION, engine.positionFromHardware())
        initialised = true
    }

    /** Re-attach the fine stage, e.g. after the user changes a developer option. */
    fun reattach() {
        engine.fineGain.release()
        engine.fineGain.attach()
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
