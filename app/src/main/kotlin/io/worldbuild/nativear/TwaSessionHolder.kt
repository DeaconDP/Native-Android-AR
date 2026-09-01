package io.worldbuild.nativear

import android.content.ComponentName
import androidx.browser.customtabs.CustomTabsClient
import androidx.browser.customtabs.CustomTabsServiceConnection
import androidx.browser.customtabs.CustomTabsSession

object TwaSessionHolder {
    var customTabsSession: CustomTabsSession? = null
        private set

    private var client: CustomTabsClient? = null

    fun bind(application: NativeArApplication) {
        val connection = object : CustomTabsServiceConnection() {
            override fun onCustomTabsServiceConnected(
                name: ComponentName,
                newClient: CustomTabsClient,
            ) {
                client = newClient
                client?.warmup(0)
                customTabsSession = client?.newSession(null)
            }

            override fun onServiceDisconnected(name: ComponentName) {
                client = null
                customTabsSession = null
            }
        }

        val packageName = CustomTabsClient.getPackageName(application, null) ?: return
        CustomTabsClient.bindCustomTabsService(application, packageName, connection)
    }
}
