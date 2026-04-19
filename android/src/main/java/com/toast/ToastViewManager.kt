package com.toast

import com.facebook.react.common.MapBuilder
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.viewmanagers.ToastViewManagerInterface
import com.facebook.react.viewmanagers.ToastViewManagerDelegate

@ReactModule(name = ToastViewManager.NAME)
class ToastViewManager : SimpleViewManager<ToastView>(),
    ToastViewManagerInterface<ToastView> {

    private val mDelegate: ViewManagerDelegate<ToastView> = ToastViewManagerDelegate(this)

    override fun getDelegate(): ViewManagerDelegate<ToastView> = mDelegate

    override fun getName(): String = NAME

    override fun createViewInstance(context: ThemedReactContext): ToastView {
        return ToastView(context)
    }

    override fun onAfterUpdateTransaction(view: ToastView) {
        super.onAfterUpdateTransaction(view)
        view.applyPendingUpdateIfNeeded()
    }

    // Props

    @ReactProp(name = "visible")
    override fun setVisible(view: ToastView, value: Boolean) {
        view.setVisible(value)
    }

    @ReactProp(name = "icon")
    override fun setIcon(view: ToastView, value: String?) {
        view.icon = value ?: ""
    }

    @ReactProp(name = "title")
    override fun setTitle(view: ToastView, value: String?) {
        view.toastTitle = value ?: ""
    }

    @ReactProp(name = "message")
    override fun setMessage(view: ToastView, value: String?) {
        view.toastMessage = value ?: ""
    }

    @ReactProp(name = "duration")
    override fun setDuration(view: ToastView, value: Int) {
        view.duration = value
    }

    @ReactProp(name = "autoDismiss")
    override fun setAutoDismiss(view: ToastView, value: Boolean) {
        view.autoDismiss = value
    }

    @ReactProp(name = "enableSwipeDismiss")
    override fun setEnableSwipeDismiss(view: ToastView, value: Boolean) {
        view.enableSwipeDismiss = value
    }

    @ReactProp(name = "useDynamicIsland")
    override fun setUseDynamicIsland(view: ToastView, value: Boolean) {
        view.useDynamicIsland = value
    }

    // Events

    override fun getExportedCustomBubblingEventTypeConstants(): Map<String, Any> {
        return MapBuilder.builder<String, Any>()
            .put("onToastDismiss", MapBuilder.of(
                "phasedRegistrationNames",
                MapBuilder.of("bubbled", "onToastDismiss")
            ))
            .put("onToastShow", MapBuilder.of(
                "phasedRegistrationNames",
                MapBuilder.of("bubbled", "onToastShow")
            ))
            .put("onToastPress", MapBuilder.of(
                "phasedRegistrationNames",
                MapBuilder.of("bubbled", "onToastPress")
            ))
            .build()
    }

    companion object {
        const val NAME = "ToastView"
    }
}
