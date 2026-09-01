package io.worldbuild.nativear

import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.browser.customtabs.CustomTabsIntent
import androidx.browser.trusted.TrustedWebActivityIntentBuilder

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val url = Uri.parse(BuildConfig.TWA_URL)
        val session = TwaSessionHolder.customTabsSession

        if (session != null) {
            val intent = TrustedWebActivityIntentBuilder(url)
                .build(session)
                .intent

            try {
                startActivity(intent)
                finish()
                return
            } catch (_: Exception) {
                // Fall through to Custom Tab.
            }
        }

        Toast.makeText(
            this,
            getString(R.string.twa_fallback_message),
            Toast.LENGTH_LONG,
        ).show()
        CustomTabsIntent.Builder(session).build().launchUrl(this, url)
        finish()
    }
}
