package com.richmasters.finevolume

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.richmasters.finevolume.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private val listener: (Int) -> Unit = { position ->
        runOnUiThread {
            binding.volumeBar.position = position
            render(position)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        VolumeController.init(this)

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.volumeBar.position = VolumeController.position
        binding.volumeBar.onPositionChanged = { VolumeController.set(it) }

        binding.buttonDown.setOnClickListener { VolumeController.nudge(-1) }
        binding.buttonUp.setOnClickListener { VolumeController.nudge(+1) }

        binding.buttonCalibrate.setOnClickListener {
            startActivity(Intent(this, CalibrationActivity::class.java))
        }
        binding.buttonDiagnostics.setOnClickListener {
            startActivity(Intent(this, DiagnosticsActivity::class.java))
        }
        binding.buttonNotification.setOnClickListener {
            requestNotificationPermissionIfNeeded()
            ContextCompat.startForegroundService(this, Intent(this, VolumeService::class.java))
        }
        binding.buttonKeys.setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        render(VolumeController.position)
    }

    override fun onResume() {
        super.onResume()
        VolumeController.addListener(listener)
        render(VolumeController.position)
    }

    override fun onPause() {
        VolumeController.removeListener(listener)
        super.onPause()
    }

    private fun render(position: Int) {
        binding.percentage.text = position.toString()

        val engine = VolumeController.engine
        val ladder = engine.ladder()
        val targetDb = engine.targetDbFor(position, ladder)

        binding.detail.text = if (engine.fineGain.backend == FineGain.Backend.NONE) {
            "%.1f dB · hardware step only · %d real steps".format(targetDb, ladder.steps)
        } else {
            "%.1f dB · %.1f dB per step · %s".format(
                targetDb,
                engine.stepSizeDb(ladder),
                if (engine.fineGain.isFlat) "exact" else "approx"
            )
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val granted = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }
    }
}
