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
    var toastTitle: String = ""
    var toastMessage: String = ""
    var duration: Int = 3000
    var autoDismiss: Boolean = true
    var enableSwipeDismiss: Boolean = true

    init {
        visibility = GONE
    }

    fun setVisible(visible: Boolean) {
        if (visible) {
            // Defer to next frame so all other props (icon, title, message)
            // are set before we actually show the toast
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
            }
        }

        overlay?.show(icon, toastTitle, toastMessage, duration, autoDismiss, enableSwipeDismiss)
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
