package com.richmasters.finevolume

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

        refresh()
    }

    private fun refresh() {
        binding.report.text = Diagnostics.report(this, VolumeController.engine)
    }

    /**
     * The only test that actually settles it. Drops the fine stage by 12 dB for three
     * seconds without touching the hardware index — so if the music dips and comes back,
     * software attenuation reaches your ears and the whole approach works. If nothing
     * happens, the effect attached but is being bypassed somewhere downstream.
     */
    private fun runAudibleTest() {
        val fineGain = VolumeController.engine.fineGain
        if (fineGain.backend == FineGain.Backend.NONE) {
            binding.testResult.text = "No fine gain backend attached — nothing to test."
            return
        }

        val accepted = fineGain.setGainDb(-12f)
        binding.testResult.text = if (accepted) {
            "Applied -12 dB. Music playing? It should be noticeably quieter for 3 seconds."
        } else {
            "The backend rejected the call — treat that as a failure."
        }

        handler.postDelayed({
            fineGain.setGainDb(0f)
            binding.testResult.append("\n\nRestored. Did you hear it dip?")
        }, 3000)
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
