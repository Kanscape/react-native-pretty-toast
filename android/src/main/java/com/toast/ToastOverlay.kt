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
import com.toast.backdrop.BackdropSampler
import com.toast.backdrop.OutlineController
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
    private var backdropSampler: BackdropSampler? = null
    private var outline: OutlineController? = null

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
            startBackdropSampling()
        }

        if (autoDismiss && duration > 0) {
            dismissRunnable = Runnable { dismiss() }
            handler.postDelayed(dismissRunnable!!, duration.toLong())
        }
    }

    /**
     * Mutates the currently presented toast in place. Updates icon/title/
     * message on the live view hierarchy and restarts the auto-dismiss timer
     * with the new duration — does NOT re-run the expand animation.
     */
    fun update(
        icon: String,
        title: String,
        message: String,
        duration: Int,
        autoDismiss: Boolean,
    ) {
        val built = views ?: return
        if (!isShowing || isDismissing) return

        updateContent(built, icon, title, message)

        cancelAutoDismiss()
        if (autoDismiss && duration > 0) {
            dismissRunnable = Runnable { dismiss() }
            handler.postDelayed(dismissRunnable!!, duration.toLong())
        }
    }

    fun dismiss() {
        if (!isShowing || isDismissing) return
        isDismissing = true
        cancelAutoDismiss()

        // Stop sampling + freeze any in-flight stroke crossfade before we
        // hand off to the animator. Runs on every dismiss path — including
        // the `animator == null` early return below — so we never leave a
        // tick runnable or a ValueAnimator running against a view that's
        // about to go away.
        stopBackdropSampling()
        outline?.cancel()

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
        stopBackdropSampling()
        outline?.cancel()
        outline = null
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

        outline = OutlineController(
            pillBackground = built.pillBackground,
            strokeWidthPx = built.strokeWidthPx,
        )

        views = built
        return built
    }

    // MARK: - Backdrop sampling
    //
    // Mirrors iOS's PassThroughWindow sampler: while the toast is on-screen,
    // average the luminance of the top strip of the app's content view and
    // flip the outline between the toast's accent colour and a faint neutral
    // white. `OutlineController` handles the 300 ms ARGB crossfade between
    // the two stroke colours so the change is a soft transition, not a pop.

    private fun startBackdropSampling() {
        val activity = this.activity ?: return
        val density = Density.from(activity.resources)
        stopBackdropSampling()
        val sampler = BackdropSampler(
            activity = activity,
            density = density,
            onTintChanged = { tint -> outline?.setTint(tint, animated = true) },
        )
        backdropSampler = sampler
        sampler.start()
        // Seed the stroke with the sampler's first reading (which it computed
        // synchronously in start()) so we don't flash the default grey tint.
        outline?.setTint(sampler.tint, animated = false)
    }

    private fun stopBackdropSampling() {
        backdropSampler?.stop()
        backdropSampler = null
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
        // Hand the icon tint to the outline controller as the accent colour —
        // mirrors iOS where the pill's stroke takes the SF-symbol tint.
        outline?.setAccent(tint)

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
