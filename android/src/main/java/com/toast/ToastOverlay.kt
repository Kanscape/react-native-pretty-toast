package com.toast

import android.app.Activity
import android.graphics.Color
import android.graphics.Rect
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.dynamicanimation.animation.DynamicAnimation
import androidx.dynamicanimation.animation.SpringAnimation
import androidx.dynamicanimation.animation.SpringForce

class ToastOverlay(private val activity: Activity) {

    private var overlayContainer: PassThroughFrameLayout? = null
    private var pillView: LinearLayout? = null
    private var iconView: ImageView? = null
    private var titleView: TextView? = null
    private var messageView: TextView? = null
    private var statusBarHeight: Int = 0

    private val handler = Handler(Looper.getMainLooper())
    private var dismissRunnable: Runnable? = null
    private var isShowing = false
    private var isDismissing = false

    var onDismiss: (() -> Unit)? = null
    var onPress: (() -> Unit)? = null

    private var touchStartX = 0f
    private var touchStartY = 0f
    private var pillTranslationYOnDown = 0f

    fun show(
        icon: String,
        title: String,
        message: String,
        duration: Int,
        autoDismiss: Boolean,
        enableSwipeDismiss: Boolean
    ) {
        if (isDismissing) {
            handler.postDelayed({
                show(icon, title, message, duration, autoDismiss, enableSwipeDismiss)
            }, 50)
            return
        }

        cancelAutoDismiss()
        isDismissing = false

        ensureOverlay()

        val pill = pillView ?: return

        // Update content
        updateIcon(icon)
        titleView?.text = title

        if (message.isNotEmpty()) {
            messageView?.text = message
            messageView?.visibility = View.VISIBLE
        } else {
            messageView?.visibility = View.GONE
        }

        // Setup gestures
        setupGestures(pill, enableSwipeDismiss)

        if (!isShowing) {
            isShowing = true
            overlayContainer?.visibility = View.VISIBLE

            // Start offscreen
            pill.translationY = -dpToPx(200f)
            pill.alpha = 1f

            // Spring animate in
            val spring = SpringAnimation(pill, DynamicAnimation.TRANSLATION_Y, 0f)
            spring.spring.apply {
                dampingRatio = 0.75f
                stiffness = SpringForce.STIFFNESS_MEDIUM
            }
            spring.start()
        }

        // Auto-dismiss
        if (autoDismiss && duration > 0) {
            dismissRunnable = Runnable { dismiss() }
            handler.postDelayed(dismissRunnable!!, duration.toLong())
        }
    }

    fun dismiss() {
        if (!isShowing || isDismissing) return
        isDismissing = true
        cancelAutoDismiss()

        val pill = pillView ?: run {
            isShowing = false
            isDismissing = false
            onDismiss?.invoke()
            return
        }

        // Animate out upward
        val spring = SpringAnimation(pill, DynamicAnimation.TRANSLATION_Y, -dpToPx(200f))
        spring.spring.apply {
            dampingRatio = SpringForce.DAMPING_RATIO_NO_BOUNCY
            stiffness = SpringForce.STIFFNESS_MEDIUM
        }
        spring.addEndListener { _, _, _, _ ->
            isShowing = false
            isDismissing = false
            overlayContainer?.visibility = View.GONE
            onDismiss?.invoke()
        }
        spring.start()

        pill.animate()
            .alpha(0f)
            .setDuration(250)
            .start()
    }

    fun destroy() {
        cancelAutoDismiss()
        handler.removeCallbacksAndMessages(null)
        val decorView = activity.window?.decorView as? ViewGroup ?: return
        overlayContainer?.let { decorView.removeView(it) }
        overlayContainer = null
        pillView = null
        iconView = null
        titleView = null
        messageView = null
    }

    private fun ensureOverlay() {
        if (overlayContainer != null) return

        val decorView = activity.window?.decorView as? ViewGroup ?: return

        // Get status bar height
        ViewCompat.getRootWindowInsets(decorView)?.let { insets ->
            statusBarHeight = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
        }
        if (statusBarHeight == 0) {
            val resourceId = activity.resources.getIdentifier("status_bar_height", "dimen", "android")
            if (resourceId > 0) {
                statusBarHeight = activity.resources.getDimensionPixelSize(resourceId)
            }
        }

        // Overlay container — full screen, passes touches outside pill
        val container = PassThroughFrameLayout(activity)
        container.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        container.visibility = View.GONE

        // Pill — black rounded rect, matches iOS aesthetic
        val pill = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL

            background = GradientDrawable().apply {
                setColor(Color.BLACK)
                cornerRadius = dpToPx(30f)
            }
            elevation = dpToPx(8f)

            val hPad = dpToPx(20f).toInt()
            val vPad = dpToPx(14f).toInt()
            setPadding(hPad, vPad, hPad, vPad)
        }

        val screenWidth = activity.resources.displayMetrics.widthPixels
        val pillMargin = dpToPx(10f).toInt()
        val pillWidth = screenWidth - pillMargin * 2
        pill.layoutParams = FrameLayout.LayoutParams(pillWidth, FrameLayout.LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            topMargin = statusBarHeight + dpToPx(10f).toInt()
        }

        // Icon — 35dp to match iOS .system(size: 35)
        val iconSize = dpToPx(35f).toInt()
        val icon = ImageView(activity).apply {
            layoutParams = LinearLayout.LayoutParams(dpToPx(50f).toInt(), iconSize)
            scaleType = ImageView.ScaleType.CENTER_INSIDE
        }

        // Text container
        val textContainer = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = dpToPx(10f).toInt()
            }
        }

        // Title — matches iOS .callout .semibold
        val titleTv = TextView(activity).apply {
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        }

        // Message — matches iOS .caption, white @ 60%
        val messageTv = TextView(activity).apply {
            setTextColor(Color.argb(153, 255, 255, 255))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
        }

        textContainer.addView(titleTv)
        textContainer.addView(messageTv)
        pill.addView(icon)
        pill.addView(textContainer)
        container.addView(pill)
        decorView.addView(container)

        overlayContainer = container
        pillView = pill
        iconView = icon
        titleView = titleTv
        messageView = messageTv
        container.pillView = pill
    }

    private fun setupGestures(pill: LinearLayout, enableSwipeDismiss: Boolean) {
        pill.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    touchStartX = event.rawX
                    touchStartY = event.rawY
                    pillTranslationYOnDown = pill.translationY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    if (enableSwipeDismiss) {
                        val dy = event.rawY - touchStartY
                        if (dy < 0) {
                            pill.translationY = pillTranslationYOnDown + dy
                        }
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    val dy = event.rawY - touchStartY
                    val dx = event.rawX - touchStartX

                    if (enableSwipeDismiss && dy < -dpToPx(50f)) {
                        // Swipe up — dismiss
                        dismiss()
                    } else if (Math.abs(dy) < dpToPx(10f) && Math.abs(dx) < dpToPx(10f)) {
                        // Tap
                        onPress?.invoke()
                        snapBack(pill)
                    } else {
                        // Partial drag, snap back
                        snapBack(pill)
                    }
                    true
                }
                MotionEvent.ACTION_CANCEL -> {
                    snapBack(pill)
                    true
                }
                else -> false
            }
        }
    }

    private fun snapBack(pill: View) {
        val spring = SpringAnimation(pill, DynamicAnimation.TRANSLATION_Y, 0f)
        spring.spring.apply {
            dampingRatio = 0.75f
            stiffness = SpringForce.STIFFNESS_MEDIUM
        }
        spring.start()
    }

    private fun updateIcon(symbolName: String) {
        val icon = iconView ?: return
        val (drawableRes, tintColor) = mapIcon(symbolName)
        icon.setImageResource(drawableRes)
        icon.setColorFilter(tintColor)
    }

    private fun mapIcon(symbolName: String): Pair<Int, Int> {
        return when {
            symbolName.contains("checkmark") -> R.drawable.ic_check_circle to Color.parseColor("#4CAF50")
            symbolName.contains("xmark") -> R.drawable.ic_cancel to Color.parseColor("#F44336")
            symbolName.contains("exclamation") -> R.drawable.ic_warning to Color.parseColor("#FF9800")
            symbolName.contains("info") -> R.drawable.ic_info to Color.parseColor("#2196F3")
            symbolName.contains("heart") -> R.drawable.ic_favorite to Color.parseColor("#E91E63")
            symbolName.contains("arrow.down") -> R.drawable.ic_arrow_downward to Color.parseColor("#2196F3")
            symbolName.contains("arrow") -> R.drawable.ic_arrow_upward to Color.parseColor("#2196F3")
            symbolName.contains("envelope") || symbolName.contains("mail") -> R.drawable.ic_mail to Color.parseColor("#2196F3")
            symbolName.contains("wifi") -> R.drawable.ic_wifi to Color.WHITE
            symbolName.contains("hand") || symbolName.contains("tap") -> R.drawable.ic_touch_app to Color.WHITE
            else -> R.drawable.ic_notifications to Color.GRAY
        }
    }

    private fun cancelAutoDismiss() {
        dismissRunnable?.let { handler.removeCallbacks(it) }
        dismissRunnable = null
    }

    private fun dpToPx(dp: Float): Float {
        return dp * activity.resources.displayMetrics.density
    }
}

/**
 * FrameLayout that passes through touches outside the pill area.
 */
class PassThroughFrameLayout(context: android.content.Context) : FrameLayout(context) {
    var pillView: View? = null

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        val pill = pillView ?: return false

        // Account for the pill's current translationY when checking bounds
        val loc = IntArray(2)
        pill.getLocationOnScreen(loc)
        val pillRect = Rect(
            loc[0],
            loc[1],
            loc[0] + pill.width,
            loc[1] + pill.height
        )

        return if (pillRect.contains(ev.rawX.toInt(), ev.rawY.toInt())) {
            super.dispatchTouchEvent(ev)
        } else {
            false // Pass through to views underneath
        }
    }
}
