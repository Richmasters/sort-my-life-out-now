package com.richmasters.finevolume

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AppCompatActivity
import com.richmasters.finevolume.databinding.ActivityDiagnosticsBinding

class DiagnosticsActivity : AppCompatActivity() {

    private lateinit var binding: ActivityDiagnosticsBinding
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        VolumeController.init(this)
        binding = ActivityDiagnosticsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.buttonRefresh.setOnClickListener {
            VolumeController.reattach()
            refresh()
        }
        binding.buttonAudibleTest.setOnClickListener { runAudibleTest() }
        binding.buttonSweepTest.setOnClickListener { runSweepTest() }
        binding.buttonShare.setOnClickListener { shareReport() }

        refresh()
    }

    private fun refresh() {
        binding.report.text = Diagnostics.report(this, VolumeController.engine)
        // The report probes the fine stage, which moves the gain about; put it back.
        VolumeController.set(VolumeController.position)
    }

    private fun shareReport() {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "Fine Volume diagnostics")
            putExtra(Intent.EXTRA_TEXT, binding.report.text.toString())
        }
        startActivity(Intent.createChooser(intent, "Share diagnostics"))
    }

    /**
     * Drops the fine stage by 12 dB for three seconds without touching the hardware
     * index. If the music dips and returns, software attenuation is reaching your ears.
     */
    private fun runAudibleTest() {
        val fineGain = VolumeController.engine.fineGain
        if (fineGain.backend == FineGain.Backend.NONE) {
            binding.testResult.text = "No backend attached — nothing to test."
            return
        }

        val accepted = fineGain.setGainDb(-12f)
        binding.testResult.text = if (accepted) {
            "Applied -12 dB for 3 seconds. It should be clearly quieter."
        } else {
            "The backend rejected the call — treat that as a failure."
        }

        handler.postDelayed({
            fineGain.setGainDb(0f)
            binding.testResult.append("\n\nRestored.")
        }, 3000)
    }

    /**
     * The test that matters once something has attached. Walks down in 0.5 dB steps —
     * the resolution the 100-step slider actually uses — so you can hear whether the
     * fine steps are even and smooth, or lumpy and tonally coloured. The Equalizer
     * backend is only approximately flat, and this is where that shows up.
     */
    private fun runSweepTest() {
        val fineGain = VolumeController.engine.fineGain
        if (fineGain.backend == FineGain.Backend.NONE) {
            binding.testResult.text = "No backend attached — nothing to test."
            return
        }

        handler.removeCallbacksAndMessages(null)
        binding.testResult.text = "Stepping down 0.5 dB at a time to -6 dB, then back.\n" +
            "Listen for even steps rather than lumps."

        val steps = (0..12).map { it * -0.5f } + (11 downTo 0).map { it * -0.5f }
        steps.forEachIndexed { i, gain ->
            handler.postDelayed({
                fineGain.setGainDb(gain)
                binding.testResult.text = "Sweep: %.1f dB".format(gain)
                if (i == steps.lastIndex) {
                    binding.testResult.append("\n\nDone. Even steps, or lumpy?")
                }
            }, i * 600L)
        }
    }

    override fun onPause() {
        // Leaving mid-test must not strand the gain wherever the test had pushed it.
        handler.removeCallbacksAndMessages(null)
        VolumeController.set(VolumeController.position)
        super.onPause()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        VolumeController.engine.fineGain.setGainDb(0f)
        super.onDestroy()
    }
}
