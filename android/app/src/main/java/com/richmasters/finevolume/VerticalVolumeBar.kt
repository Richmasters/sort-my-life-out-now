package com.richmasters.finevolume

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import kotlin.math.roundToInt

/**
 * A tall, thumb-less fill bar. Vertical because the whole point is one-handed adjustment
 * mid-song, and thumb-less because at 1% per step a thumb is smaller than the touch slop
 * and just gets in the way — you drag anywhere on the bar and it tracks your finger.
 */
class VerticalVolumeBar @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyle: Int = 0
) : View(context, attrs, defStyle) {

    var position: Int = 50
        set(value) {
            val clamped = value.coerceIn(0, VolumeEngine.POSITIONS)
            if (field != clamped) {
                field = clamped
                invalidate()
            }
        }

    var onPositionChanged: ((Int) -> Unit)? = null

    private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF23262B.toInt()
    }
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF4C8DFF.toInt()
    }
    private val tickPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0x33FFFFFF
        strokeWidth = 1f
    }

    private val rect = RectF()

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val radius = width / 2f

        rect.set(0f, 0f, width.toFloat(), height.toFloat())
        canvas.drawRoundRect(rect, radius, radius, trackPaint)

        val fraction = position.toFloat() / VolumeEngine.POSITIONS
        val fillTop = height * (1f - fraction)
        canvas.save()
        canvas.clipRect(0f, fillTop, width.toFloat(), height.toFloat())
        canvas.drawRoundRect(rect, radius, radius, fillPaint)
        canvas.restore()

        // Decade markers, so you can find "about 60%" without reading the number.
        for (decade in 1..9) {
            val y = height * (1f - decade / 10f)
            canvas.drawLine(width * 0.3f, y, width * 0.7f, y, tickPaint)
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.action) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE -> {
                parent?.requestDisallowInterceptTouchEvent(true)
                val fraction = (1f - event.y / height).coerceIn(0f, 1f)
                val next = (fraction * VolumeEngine.POSITIONS).roundToInt()
                if (next != position) {
                    position = next
                    onPositionChanged?.invoke(next)
                }
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                parent?.requestDisallowInterceptTouchEvent(false)
                performClick()
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }
}
