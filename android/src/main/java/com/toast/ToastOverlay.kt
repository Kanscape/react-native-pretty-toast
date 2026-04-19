package com.toast

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import java.lang.ref.WeakReference
import com.toast.anim.CutoutMorphAnimator
import com.toast.anim.SlideAnimator
import com.toast.anim.ToastAnimator
import com.toast.cutout.CutoutDetector
import com.toast.gesture.ToastGestureHandler
import com.toast.ui.IconMapper
import com.toast.ui.ToastViewFactory
import com.toast.util.Density
import com.toast.util.StatusBarController
import com.toast.util.ToastConstants.DISMISS_CALLBACK_BUFFER_MS

/**
 * Thin orchestrator over the toast subsystems:
 *   - [CutoutDetector] reads device geometry into a snapshot
 *   - [ToastViewFactory] builds the view hierarchy from that snapshot
 *   - A [ToastAnimator] (cutout-morph or slide) drives show/dismiss/drag
 *   - [ToastGestureHandler] wires touches into the animator
 *
 * Owns only lifecycle/state: show flags, auto-dismiss timer, and the
 * useDynamicIsland-changed recreate rule.
 */
class ToastOverlay(activity: Activity) {

    // Hold the hosting Activity weakly so that if it's destroyed (rotation,
    // finish, process trim) while the overlay still has state lying around,
    // we don't keep it alive — we just bail out of any operation that needs it.
    private val activityRef = WeakReference(activity)
    private val activity: Activity?
        get() = activityRef.get()

    private var views: ToastViewFactory.Built? = null
    private var animator: ToastAnimator? = null
    private var cutoutAnimator: CutoutMorphAnimator? = null
    private var isCutoutMorph = false

    private val handler = Handler(Looper.getMainLooper())
    private var dismissRunnable: Runnable? = null
    // Pending status-bar restore. Scheduled after the collapse animation so
    // the bar doesn't flicker between queued toasts. Cancelled by the next
    // show() if one arrives before it fires.
    private var statusBarRestoreRunnable: Runnable? = null
    private var isShowing = false
    private var isDismissing = false
    private var useDynamicIslandProp = true

    var onDismiss: (() -> Unit)? = null
    var onPress: (() -> Unit)? = null

    fun show(
        icon: String,
        title: String,
        message: String,
        duration: Int,
        autoDismiss: Boolean,
        enableSwipeDismiss: Boolean,
        useDynamicIsland: Boolean = true
    ) {
        // If the dynamic island setting changed, recreate the overlay.
        if (useDynamicIsland != this.useDynamicIslandProp) {
            this.useDynamicIslandProp = useDynamicIsland
            destroy()
        }
        this.useDynamicIslandProp = useDynamicIsland

        if (isDismissing) {
            handler.postDelayed({
                show(icon, title, message, duration, autoDismiss, enableSwipeDismiss, useDynamicIsland)
            }, 50)
            return
        }

        cancelAutoDismiss()
        isDismissing = false

        val built = ensureOverlay() ?: return
        val currentAnimator = animator ?: return

        updateContent(built, icon, title, message)
        installGestures(built, currentAnimator, enableSwipeDismiss)

        if (!isShowing) {
            isShowing = true
            built.container.visibility = View.VISIBLE

            // Reset transforms from any previous animation before showing.
            built.pill.animate().cancel()
            built.content.animate().cancel()
            built.pill.translationY = 0f
            built.pill.scaleX = 1f
            built.pill.scaleY = 1f
            built.pill.alpha = 1f
            built.content.alpha = 1f

            currentAnimator.show()
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

        val currentAnimator = animator ?: run {
            isShowing = false
            isDismissing = false
            onDismiss?.invoke()
            return
        }

        currentAnimator.dismiss {
            isShowing = false
            isDismissing = false
            views?.container?.visibility = View.GONE
            if (isCutoutMorph) {
                scheduleStatusBarRestore()
                // Match iOS's 50ms buffer between morph end and onDismiss callback.
                handler.postDelayed({ onDismiss?.invoke() }, DISMISS_CALLBACK_BUFFER_MS)
            } else {
                onDismiss?.invoke()
            }
        }
    }

    fun destroy() {
        cancelAutoDismiss()
        cancelStatusBarRestore()
        handler.removeCallbacksAndMessages(null)
        cutoutAnimator?.cancelPendingCallbacks()

        val decorView = activity?.window?.decorView as? ViewGroup
        views?.container?.let { decorView?.removeView(it) }

        views = null
        animator = null
        cutoutAnimator = null
        isShowing = false
        isDismissing = false
    }

    private fun ensureOverlay(): ToastViewFactory.Built? {
        views?.let { return it }

        val activity = this.activity ?: return null
        val decorView = activity.window?.decorView as? ViewGroup ?: return null
        val density = Density.from(activity.resources)

        val info = CutoutDetector.detect(activity, decorView, useDynamicIsland = useDynamicIslandProp)
        isCutoutMorph = info.hasCutout

        val factory = ToastViewFactory(activity, density)
        val built = factory.build(info)
        decorView.addView(built.container)

        animator = if (info.hasCutout) {
            CutoutMorphAnimator(
                pill = built.pill,
                content = built.content,
                info = info,
                expandedCornerRadius = built.expandedCornerRadius,
                density = density,
                onBeforeShow = {
                    cancelStatusBarRestore()
                    this.activity?.let { StatusBarController.hide(it) }
                },
            ).also { cutoutAnimator = it }
        } else {
            SlideAnimator(built.pill, density)
        }

        views = built
        return built
    }

    private fun updateContent(
        built: ToastViewFactory.Built,
        icon: String,
        title: String,
        message: String,
    ) {
        val (drawableRes, tint) = IconMapper.map(icon)
        built.icon.setImageResource(drawableRes)
        built.icon.setColorFilter(tint)

        built.title.text = title
        if (message.isNotEmpty()) {
            built.message.text = message
            built.message.visibility = View.VISIBLE
        } else {
            built.message.visibility = View.GONE
        }
    }

    private fun installGestures(
        built: ToastViewFactory.Built,
        animator: ToastAnimator,
        enableSwipeDismiss: Boolean,
    ) {
        val resources = activity?.resources ?: return
        val density = Density.from(resources)
        ToastGestureHandler(
            animator = animator,
            density = density,
            enableSwipeDismiss = enableSwipeDismiss,
            onDismissRequested = { dismiss() },
            onPress = { onPress?.invoke() },
        ).install(built.pill)
    }

    private fun cancelAutoDismiss() {
        dismissRunnable?.let { handler.removeCallbacks(it) }
        dismissRunnable = null
    }

    // The animator completion already fires after the collapse animation ends;
    // the extra delay here is a grace window so a queued toast's show() can
    // cancel the restore before the status bar visibly flashes.
    private fun scheduleStatusBarRestore() {
        cancelStatusBarRestore()
        val runnable = Runnable {
            activity?.let { StatusBarController.show(it) }
        }
        statusBarRestoreRunnable = runnable
        handler.postDelayed(runnable, STATUS_BAR_RESTORE_GRACE_MS)
    }

    private fun cancelStatusBarRestore() {
        statusBarRestoreRunnable?.let { handler.removeCallbacks(it) }
        statusBarRestoreRunnable = null
    }

    companion object {
        private const val STATUS_BAR_RESTORE_GRACE_MS = 250L
    }
}
