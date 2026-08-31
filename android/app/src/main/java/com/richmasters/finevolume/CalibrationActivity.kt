package com.richmasters.finevolume

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.SeekBar
import androidx.appcompat.app.AppCompatActivity
import com.richmasters.finevolume.databinding.ActivityCalibrationBinding

/**
 * Measures what the fine stage actually delivers, by ear.
 *
 * The Equalizer backend pins every band to one level and the overlapping filters sum, so
 * a request for -6 dB might really be -8. The app cannot measure its own output, but it
 * does know the exact dB separation of any two hardware steps — so it can ask the fine
 * stage to bridge a known gap and let you judge whether it did.
 *
 *   A  quieter hardware step, no trim
 *   B  louder hardware step, trimmed by the amount under test
 *
 * When A and B sound equally loud, the trim being requested is delivering exactly the
 * gap between those two steps, and the ratio between the two is the scale factor.
 *
 * Pointless when the backend is already flat, so we say so and don't waste your time.
 */
class CalibrationActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCalibrationBinding
    private val handler = Handler(Looper.getMainLooper())

    private var louderIndex = 0
    private var quieterIndex = 0
    private var gapDb = 0f
    private var requestedDb = 0f
    private var showingB = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        VolumeController.init(this)
        binding = ActivityCalibrationBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val engine = VolumeController.engine
        val ladder = engine.ladder()

        if (engine.fineGain.backend == FineGain.Backend.NONE) {
            finishWithMessage("No fine gain stage attached — nothing to calibrate.")
            return
        }
        if (engine.fineGain.isFlat) {
            finishWithMessage(
                "This device is using DynamicsProcessing, whose gain stage is already " +
                    "exact. Calibration would only add error."
            )
            return
        }

        val pair = engine.calibrationPair(ladder)
        if (pair == null) {
            finishWithMessage("Could not find two usable hardware steps to compare.")
            return
        }

        louderIndex = pair.first
        quieterIndex = pair.second
        gapDb = ladder.db[louderIndex] - ladder.db[quieterIndex]
        requestedDb = -gapDb

        binding.explain.text = buildString {
            appendLine("Start your music, then adjust until A and B sound equally loud.")
            appendLine()
            appendLine("A = hardware step $quieterIndex, no trim")
            appendLine("B = hardware step $louderIndex, trimmed to match")
            appendLine()
            appendLine("The true gap between those steps is %.2f dB.".format(gapDb))
            appendLine("Whatever trim makes them match is what the fine stage really")
            appendLine("delivers for that request.")
        }

        binding.slider.max = SLIDER_STEPS
        binding.slider.progress = SLIDER_STEPS / 2
        binding.slider.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(bar: SeekBar?, progress: Int, fromUser: Boolean) {
                requestedDb = requestedForProgress(progress)
                renderValue()
            }

            override fun onStartTrackingTouch(bar: SeekBar?) = Unit
            override fun onStopTrackingTouch(bar: SeekBar?) = Unit
        })

        binding.buttonMatched.setOnClickListener { saveScale() }
        binding.buttonReset.setOnClickListener {
            VolumeController.setGainScale(1f)
            finishWithMessage("Scale reset to 1.0 (no correction).")
        }

        requestedDb = requestedForProgress(binding.slider.progress)
        renderValue()
        startAlternating()
    }

    /** Sweeps from half the gap to double it, which brackets any plausible error. */
    private fun requestedForProgress(progress: Int): Float {
        val fraction = progress.toFloat() / SLIDER_STEPS
        val magnitude = gapDb * (0.5f + 1.5f * fraction)
        return -magnitude
    }

    private fun renderValue() {
        binding.value.text = "Trim under test: %.2f dB".format(requestedDb)
        if (showingB) applyState()
    }

    private fun startAlternating() {
        val tick = object : Runnable {
            override fun run() {
                showingB = !showingB
                applyState()
                binding.state.text = if (showingB) "B" else "A"
                handler.postDelayed(this, 1800)
            }
        }
        handler.post(tick)
    }

    private fun applyState() {
        val engine = VolumeController.engine
        if (showingB) {
            engine.applyRawForCalibration(louderIndex, requestedDb)
        } else {
            engine.applyRawForCalibration(quieterIndex, 0f)
        }
    }

    private fun saveScale() {
        // A trim of `requestedDb` was judged to deliver exactly `gapDb`.
        val scale = gapDb / kotlin.math.abs(requestedDb)
        VolumeController.setGainScale(scale)
        finishWithMessage(
            "Saved. The fine stage delivers %.2f dB for every 1 dB requested.".format(scale)
        )
    }

    private fun finishWithMessage(message: String) {
        handler.removeCallbacksAndMessages(null)
        binding.explain.text = message
        binding.state.text = ""
        binding.value.text = ""
        binding.slider.isEnabled = false
        binding.buttonMatched.isEnabled = false
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        // Put the user back where they were, rather than on whichever test step was last.
        VolumeController.set(VolumeController.position)
        super.onDestroy()
    }

    private companion object {
        const val SLIDER_STEPS = 200
    }
}
