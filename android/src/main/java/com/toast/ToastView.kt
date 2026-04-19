package com.toast

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.view.View
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter

class ToastView(context: Context) : View(context) {

    private var overlay: ToastOverlay? = null
    private var isCurrentlyShowing = false
    private val handler = Handler(Looper.getMainLooper())
    private var pendingShow = false

    // Props
    var icon: String = ""
    var iconUri: String = ""
    var toastTitle: String = ""
    var toastMessage: String = ""
    var duration: Int = 3000
    var autoDismiss: Boolean = true
    var enableSwipeDismiss: Boolean = true
    var useDynamicIsland: Boolean = true
    var accentColor: Int? = null
    var strokeColor: Int? = null
    var disableBackdropSampling: Boolean = false
    var actionLabel: String = ""

    // Snapshot of values last handed to the overlay — used to detect
    // mid-flight prop changes that should map to an in-place update
    // rather than a new show cycle.
    private var lastIcon: String = ""
    private var lastIconUri: String = ""
    private var lastTitle: String = ""
    private var lastMessage: String = ""
    private var lastDuration: Int = 3000
    private var lastAutoDismiss: Boolean = true
    private var lastAccentColor: Int? = null
    private var lastStrokeColor: Int? = null
    private var lastDisableBackdropSampling: Boolean = false
    private var lastActionLabel: String = ""

    init {
        visibility = GONE
    }

    fun setVisible(visible: Boolean) {
        if (visible) {
            pendingShow = true
            handler.post {
                if (pendingShow) {
                    pendingShow = false
                    showToast()
                }
            }
        } else {
            pendingShow = false
            dismissToast()
        }
    }

    private fun showToast() {
        if (isCurrentlyShowing) return
        isCurrentlyShowing = true

        val activity = getActivity() ?: return
        if (overlay == null) {
            overlay = ToastOverlay(activity).apply {
                onDismiss = {
                    isCurrentlyShowing = false
                    emitEvent("onToastDismiss")
                }
                onPress = {
                    emitEvent("onToastPress")
                }
                onActionPress = {
                    emitEvent("onToastActionPress")
                }
            }
        }

        overlay?.show(
            icon,
            iconUri,
            toastTitle,
            toastMessage,
            duration,
            autoDismiss,
            enableSwipeDismiss,
            useDynamicIsland,
            accentColor,
            strokeColor,
            disableBackdropSampling,
            actionLabel,
        )
        snapshotProps()
    }

    fun applyPendingUpdateIfNeeded() {
        if (!isCurrentlyShowing) return
        val changed = icon != lastIcon
            || iconUri != lastIconUri
            || toastTitle != lastTitle
            || toastMessage != lastMessage
            || duration != lastDuration
            || autoDismiss != lastAutoDismiss
            || accentColor != lastAccentColor
            || strokeColor != lastStrokeColor
            || disableBackdropSampling != lastDisableBackdropSampling
            || actionLabel != lastActionLabel
        if (!changed) return
        overlay?.update(
            icon,
            iconUri,
            toastTitle,
            toastMessage,
            duration,
            autoDismiss,
            accentColor,
            strokeColor,
            disableBackdropSampling,
            actionLabel,
        )
        snapshotProps()
    }

    private fun snapshotProps() {
        lastIcon = icon
        lastIconUri = iconUri
        lastTitle = toastTitle
        lastMessage = toastMessage
        lastDuration = duration
        lastAutoDismiss = autoDismiss
        lastAccentColor = accentColor
        lastStrokeColor = strokeColor
        lastDisableBackdropSampling = disableBackdropSampling
        lastActionLabel = actionLabel
    }

    private fun dismissToast() {
        if (!isCurrentlyShowing) return
        isCurrentlyShowing = false
        overlay?.dismiss()
    }

    private fun emitEvent(eventName: String) {
        val reactContext = context as? ReactContext ?: return
        reactContext.getJSModule(RCTEventEmitter::class.java)
            ?.receiveEvent(id, eventName, null)
    }

    private fun getActivity(): Activity? {
        val reactContext = context as? ReactContext
        return reactContext?.currentActivity
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        handler.removeCallbacksAndMessages(null)
        overlay?.destroy()
        overlay = null
        isCurrentlyShowing = false
    }
}
