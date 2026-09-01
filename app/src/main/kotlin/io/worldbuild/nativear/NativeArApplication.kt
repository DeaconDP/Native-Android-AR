package io.worldbuild.nativear

import android.app.Application

class NativeArApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        TwaSessionHolder.bind(this)
    }
}
