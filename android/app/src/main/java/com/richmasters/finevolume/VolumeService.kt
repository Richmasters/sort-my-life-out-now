package com.richmasters.finevolume

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Keeps a notification in the shade with -/+ buttons, so a one-percent nudge never
 * costs you a trip to the launcher.
 */
class VolumeService : Service() {

    private val listener: (Int) -> Unit = { post() }

    override fun onCreate() {
        super.onCreate()
        VolumeController.init(this)
        createChannel()
        VolumeController.addListener(listener)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_DOWN -> VolumeController.nudge(-1)
            ACTION_UP -> VolumeController.nudge(+1)
            ACTION_STOP -> {
                stopSelf()
                return START_NOT_STICKY
            }
        }
        startForeground(NOTIFICATION_ID, build())
        return START_STICKY
    }

    override fun onDestroy() {
        VolumeController.removeListener(listener)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun post() {
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, build())
    }

    private fun build(): Notification {
        val position = VolumeController.position
        val engine = VolumeController.engine
        val ladder = engine.ladder()
        val detail = if (engine.fineGain.backend == FineGain.Backend.NONE) {
            "%.1f dB · %d hardware steps".format(engine.targetDbFor(position, ladder), ladder.steps)
        } else {
            "%.1f dB · %.1f dB per step".format(
                engine.targetDbFor(position, ladder),
                engine.stepSizeDb(ladder)
            )
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_volume)
            .setContentTitle("Volume $position")
            .setContentText(detail)
            .setContentIntent(
                PendingIntent.getActivity(
                    this, 0, Intent(this, MainActivity::class.java),
                    PendingIntent.FLAG_IMMUTABLE
                )
            )
            .addAction(R.drawable.ic_minus, "Down", command(ACTION_DOWN, 1))
            .addAction(R.drawable.ic_plus, "Up", command(ACTION_UP, 2))
            .addAction(R.drawable.ic_close, "Dismiss", command(ACTION_STOP, 3))
            .setOngoing(true)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
    }

    private fun command(action: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, VolumeService::class.java).setAction(action)
        return PendingIntent.getService(this, requestCode, intent, PendingIntent.FLAG_IMMUTABLE)
    }

    private fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Volume control",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "The persistent volume control in your notification shade"
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private companion object {
        const val CHANNEL_ID = "volume_control"
        const val NOTIFICATION_ID = 1

        const val ACTION_DOWN = "com.richmasters.finevolume.DOWN"
        const val ACTION_UP = "com.richmasters.finevolume.UP"
        const val ACTION_STOP = "com.richmasters.finevolume.STOP"
    }
}
