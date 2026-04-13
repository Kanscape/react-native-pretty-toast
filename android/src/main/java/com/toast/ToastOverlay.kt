package com.toast

import android.animation.ValueAnimator
import android.app.Activity
import android.graphics.Color
import android.graphics.Rect
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.animation.AccelerateInterpolator
import android.view.animation.DecelerateInterpolator
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
    private var contentContainer: LinearLayout? = null
    private var statusBarHeight: Int = 0

    // Cutout detection
    private var hasCenterCutout = false
    private var cutoutRect: Rect? = null
    // Collapsed dimensions based on actual cutout size, with padding
    private val collapsedWidth: Float get() {
        val cutoutW = cutoutRect?.width()?.toFloat() ?: dpToPx(120f)
        // Make collapsed pill wider than the cutout itself (like iOS DI capsule)
        return (cutoutW * 1.5f).coerceAtLeast(dpToPx(120f))
    }
    private val collapsedHeight: Float get() {
        val cutoutH = cutoutRect?.height()?.toFloat() ?: dpToPx(36f)
        return cutoutH.coerceAtLeast(dpToPx(36f))
    }

    private val handler = Handler(Looper.getMainLooper())
    private var dismissRunnable: Runnable? = null
    private var isShowing = false
    private var isDismissing = false
    private var useDynamicIslandProp = true

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
        enableSwipeDismiss: Boolean,
        useDynamicIsland: Boolean = true
    ) {
        // If the dynamic island setting changed, recreate the overlay
        if (useDynamicIsland != this.useDynamicIslandProp) {
            this.useDynamicIslandProp = useDynamicIsland
            destroy()
        }
        this.useDynamicIslandProp = useDynamicIsland

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

        setupGestures(pill, enableSwipeDismiss)

        if (!isShowing) {
            isShowing = true
            overlayContainer?.visibility = View.VISIBLE

            // Reset all transforms from any previous animation
            pill.animate().cancel()
            contentContainer?.animate()?.cancel()
            pill.translationY = 0f
            pill.scaleX = 1f
            pill.scaleY = 1f
            pill.alpha = 1f
            contentContainer?.alpha = 1f

            // Hide status bar when showing toast
            if (hasCenterCutout) {
                hideStatusBar()
            }

            if (hasCenterCutout) {
                showWithCutoutAnimation(pill)
            } else {
                showWithSlideAnimation(pill)
            }
        }

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

        if (hasCenterCutout) {
            dismissWithCutoutAnimation(pill)
        } else {
            dismissWithSlideAnimation(pill)
        }
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
        contentContainer = null
    }

    // MARK: - Cutout Animation (Dynamic Island-like)

    private fun showWithCutoutAnimation(pill: LinearLayout) {
        // Use actual pill width, not hardcoded
        val expandedWidth = pill.layoutParams.width.toFloat()

        val scaleX = collapsedWidth / expandedWidth
        val scaleY = collapsedHeight / pill.height.toFloat().coerceAtLeast(dpToPx(70f))

        pill.pivotX = expandedWidth / 2f
        pill.pivotY = 0f
        pill.scaleX = scaleX
        pill.scaleY = scaleY
        pill.alpha = 1f
        contentContainer?.alpha = 0f

        // Animate expand
        pill.animate()
            .scaleX(1f)
            .scaleY(1f)
            .setDuration(300)
            .setInterpolator(DecelerateInterpolator(1.5f))
            .start()

        contentContainer?.animate()
            ?.alpha(1f)
            ?.setDuration(250)
            ?.setStartDelay(100)
            ?.start()
    }

    private fun dismissWithCutoutAnimation(pill: LinearLayout) {
        val expandedWidth = pill.width.toFloat().coerceAtLeast(1f)

        val scaleX = collapsedWidth / expandedWidth
        val scaleY = collapsedHeight / pill.height.toFloat().coerceAtLeast(dpToPx(70f))

        contentContainer?.animate()
            ?.alpha(0f)
            ?.setDuration(150)
            ?.start()

        // Scale down and fade out simultaneously — no two-step pop
        pill.animate()
            .scaleX(scaleX)
            .scaleY(scaleY)
            .alpha(0f)
            .setDuration(300)
            .setInterpolator(AccelerateInterpolator(1.2f))
            .withEndAction {
                isShowing = false
                isDismissing = false
                overlayContainer?.visibility = View.GONE
                pill.scaleX = 1f
                pill.scaleY = 1f
                pill.alpha = 1f
                contentContainer?.alpha = 1f
                showStatusBar()
                onDismiss?.invoke()
            }
            .start()
    }

    // MARK: - Slide Animation (non-cutout fallback)

    private fun showWithSlideAnimation(pill: LinearLayout) {
        pill.translationY = -dpToPx(200f)
        pill.alpha = 1f

        val spring = SpringAnimation(pill, DynamicAnimation.TRANSLATION_Y, 0f)
        spring.spring.apply {
            dampingRatio = 0.75f
            stiffness = SpringForce.STIFFNESS_MEDIUM
        }
        spring.start()
    }

    private fun dismissWithSlideAnimation(pill: LinearLayout) {
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

    // MARK: - Overlay Setup

    private fun ensureOverlay() {
        if (overlayContainer != null) return

        val decorView = activity.window?.decorView as? ViewGroup ?: return
        val screenWidth = activity.resources.displayMetrics.widthPixels

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

        // Detect center display cutout
        detectCutout(decorView, screenWidth)
        // Allow JS to disable cutout/dynamic island behavior
        if (!useDynamicIslandProp) {
            hasCenterCutout = false
        }

        val density = activity.resources.displayMetrics.density

        // Overlay container
        val container = PassThroughFrameLayout(activity)
        container.layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        container.visibility = View.GONE

        // Pill
        val pill = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(Color.BLACK)
                cornerRadius = dpToPx(30f)
            }
            elevation = dpToPx(8f)
        }

        val screenCornerRadius = getScreenCornerRadius(decorView)

        // Step 1: Determine pill top position
        val topMargin: Int
        if (hasCenterCutout && cutoutRect != null) {
            // Position pill so the camera sits inside the pill's upper area.
            // centerY/3 places the pill close enough to wrap the camera on
            // devices where the bounding rect starts at y=0.
            // If cutoutRect.top > 0 (camera not at screen edge), use that directly.
            val fromCenter = cutoutRect!!.centerY() / 3
            val fromTop = if (cutoutRect!!.top > 0) cutoutRect!!.top else Int.MAX_VALUE
            topMargin = minOf(fromCenter, fromTop).coerceAtLeast(dpToPx(4f).toInt())
        } else {
            topMargin = statusBarHeight + dpToPx(10f).toInt()
        }

        // Step 2: At the pill's top Y, calculate horizontal margin to clear screen corners
        val pillMargin: Int
        if (screenCornerRadius > 0 && topMargin < screenCornerRadius) {
            val r = screenCornerRadius.toDouble()
            val y = topMargin.toDouble()
            val horizontalInset = (r - Math.sqrt(r * r - (r - y) * (r - y))).toInt()
            pillMargin = (horizontalInset + dpToPx(4f).toInt()).coerceAtLeast(dpToPx(10f).toInt())
        } else {
            pillMargin = dpToPx(10f).toInt()
        }
        val pillWidth = screenWidth - pillMargin * 2

        // Update pill corner radius to be concentric with screen corners
        if (hasCenterCutout && screenCornerRadius > 0) {
            val inset = maxOf(pillMargin, topMargin)
            val concentricRadius = (screenCornerRadius - inset).toFloat().coerceAtLeast(dpToPx(20f))
            (pill.background as? GradientDrawable)?.cornerRadius = concentricRadius
        }

        pill.layoutParams = FrameLayout.LayoutParams(pillWidth, FrameLayout.LayoutParams.WRAP_CONTENT).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            this.topMargin = topMargin
        }

        // Content container inside pill — holds icon + text
        // Separate from pill so we can fade it independently
        val content = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val hPad = dpToPx(20f).toInt()
            val vPad = dpToPx(14f).toInt()
            // If cutout mode, push content below the camera hole
            val topPad = if (hasCenterCutout && cutoutRect != null) {
                val cutoutCenterY = cutoutRect!!.centerY()
                val cutoutRadius = cutoutRect!!.width() / 2
                val cameraBottom = cutoutCenterY + cutoutRadius
                // Content top = camera bottom - pill top + gap
                (cameraBottom - topMargin + dpToPx(6f).toInt()).coerceAtLeast(vPad)
            } else {
                vPad
            }
            setPadding(hPad, topPad, hPad, vPad)
        }

        // Icon
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

        val titleTv = TextView(activity).apply {
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        }

        val messageTv = TextView(activity).apply {
            setTextColor(Color.argb(153, 255, 255, 255))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
        }

        textContainer.addView(titleTv)
        textContainer.addView(messageTv)
        content.addView(icon)
        content.addView(textContainer)
        pill.addView(content)
        container.addView(pill)
        decorView.addView(container)

        overlayContainer = container
        pillView = pill
        contentContainer = content
        iconView = icon
        titleView = titleTv
        messageView = messageTv
        container.pillView = pill
    }

    private fun detectCutout(decorView: View, screenWidth: Int) {
        val insets = ViewCompat.getRootWindowInsets(decorView)
        val cutout = insets?.displayCutout

        if (cutout != null) {
            val topRect = cutout.boundingRects.firstOrNull { it.top == 0 || it.top < statusBarHeight }

            if (topRect != null && !topRect.isEmpty) {
                val cutoutCenterX = topRect.centerX()
                val screenCenterX = screenWidth / 2
                hasCenterCutout = Math.abs(cutoutCenterX - screenCenterX) < screenWidth * 0.2
                if (hasCenterCutout) {
                    cutoutRect = topRect
                }
            } else {
                hasCenterCutout = false
            }
        } else {
            hasCenterCutout = false
        }
    }

    // MARK: - Gestures

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
                        dismiss()
                    } else if (Math.abs(dy) < dpToPx(10f) && Math.abs(dx) < dpToPx(10f)) {
                        onPress?.invoke()
                        snapBack(pill)
                    } else {
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

    // MARK: - Icon

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

    // MARK: - Status Bar

    @Suppress("DEPRECATION")
    private fun hideStatusBar() {
        activity.window?.setFlags(
            android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN,
            android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN
        )
    }

    @Suppress("DEPRECATION")
    private fun showStatusBar() {
        activity.window?.clearFlags(android.view.WindowManager.LayoutParams.FLAG_FULLSCREEN)
    }

    private fun getScreenCornerRadius(decorView: View): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val insets = decorView.rootWindowInsets
            val topLeft = insets?.getRoundedCorner(android.view.RoundedCorner.POSITION_TOP_LEFT)
            val topRight = insets?.getRoundedCorner(android.view.RoundedCorner.POSITION_TOP_RIGHT)
            val radius = maxOf(topLeft?.radius ?: 0, topRight?.radius ?: 0)
            if (radius > 0) return radius
        }
        // Fallback: assume no rounded corners
        return 0
    }

    // MARK: - Helpers

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
            false
        }
    }
}
