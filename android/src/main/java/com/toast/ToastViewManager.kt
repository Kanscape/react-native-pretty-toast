package com.toast

import android.graphics.Color
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
  private val mDelegate: ViewManagerDelegate<ToastView>

  init {
    mDelegate = ToastViewManagerDelegate(this)
  }

  override fun getDelegate(): ViewManagerDelegate<ToastView>? {
    return mDelegate
  }

  override fun getName(): String {
    return NAME
  }

  public override fun createViewInstance(context: ThemedReactContext): ToastView {
    return ToastView(context)
  }

  @ReactProp(name = "color")
  override fun setColor(view: ToastView?, color: Int?) {
    view?.setBackgroundColor(color ?: Color.TRANSPARENT)
  }

  companion object {
    const val NAME = "ToastView"
  }
}
