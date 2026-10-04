package com.allornothing.game

import android.annotation.SuppressLint
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var ttsManager: TextToSpeechManager
    private lateinit var licenseManager: LicenseManager
    private var isCold: Boolean = true
    private val mainHandler = Handler(Looper.getMainLooper())

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        isCold = (savedInstanceState == null)

        // Enable immersive fullscreen
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )

        ttsManager = TextToSpeechManager(this)
        licenseManager = LicenseManager(this)

        if (isCold) {
            licenseManager.onColdLaunch {
                mainHandler.post {
                    webView.evaluateJavascript(
                        "if (window.onEntitlementUpdated) window.onEntitlementUpdated(${licenseManager.getEntitlementInfoJson()});",
                        null
                    )
                }
            }
        }

        webView = WebView(this).apply {
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                textZoom = 100
                useWideViewPort = true
                loadWithOverviewMode = true
                cacheMode = WebSettings.LOAD_DEFAULT
                mediaPlaybackRequiresUserGesture = false
            }

            // Expose AndroidTTS bridge
            addJavascriptInterface(AndroidTTSBridge(ttsManager) { isCold }, "AndroidTTS")
            // Expose AndroidLicense bridge
            addJavascriptInterface(AndroidLicenseBridge(licenseManager, this@MainActivity, this), "AndroidLicense")

            webViewClient = object : WebViewClient() {}
            webChromeClient = object : WebChromeClient() {}

            // Proper state preservation: restore if possible; load asset HTML only when no state exists
            var restored = false
            if (savedInstanceState != null) {
                val bundle = restoreState(savedInstanceState)
                if (bundle != null) {
                    restored = true
                }
            }

            if (!restored) {
                loadUrl("file:///android_asset/index.html?cold=1")
            }
        }

        setContentView(webView)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        isCold = false
        webView.saveState(outState)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
    }

    override fun onPause() {
        super.onPause()
        ttsManager.stop()
    }

    override fun onDestroy() {
        super.onDestroy()
        ttsManager.shutdown()
        webView.destroy()
    }

    private class AndroidTTSBridge(
        private val ttsManager: TextToSpeechManager,
        private val isColdLaunchProvider: () -> Boolean
    ) {
        @JavascriptInterface
        fun speak(text: String?) {
            if (!text.isNullOrBlank()) {
                ttsManager.speak(text)
            }
        }

        @JavascriptInterface
        fun stop() {
            ttsManager.stop()
        }

        @JavascriptInterface
        fun setEnabled(enabled: Boolean) {
            ttsManager.setEnabled(enabled)
        }

        @JavascriptInterface
        fun setLanguage(langCode: String?) {
            if (!langCode.isNullOrBlank()) {
                ttsManager.setLanguage(langCode)
            }
        }

        @JavascriptInterface
        fun isColdLaunch(): Boolean {
            return isColdLaunchProvider()
        }
    }

    private class AndroidLicenseBridge(
        private val licenseManager: LicenseManager,
        private val activity: MainActivity,
        private val webView: WebView
    ) {
        private val handler = Handler(Looper.getMainLooper())

        @JavascriptInterface
        fun getEntitlementInfo(): String {
            return licenseManager.getEntitlementInfoJson().toString()
        }

        @JavascriptInterface
        fun activateLicense(licenseCode: String) {
            licenseManager.activateLicense(licenseCode) { success, errorCode, state ->
                handler.post {
                    val safeCode = errorCode.replace("'", "\\'")
                    webView.evaluateJavascript(
                        "if (window.onLicenseActivationResult) window.onLicenseActivationResult($success, '$safeCode', '${state.name}');",
                        null
                    )
                }
            }
        }

        @JavascriptInterface
        fun commitTrialTurn(turnId: String) {
            licenseManager.commitTrialTurn(turnId) { allowed, showPaywall, remaining ->
                handler.post {
                    webView.evaluateJavascript(
                        "if (window.onTrialTurnCommitted) window.onTrialTurnCommitted($allowed, $showPaywall, $remaining);",
                        null
                    )
                }
            }
        }

        @JavascriptInterface
        fun checkTrialStatus() {
            licenseManager.checkTrialStatus { _, state, _, _ ->
                handler.post {
                    webView.evaluateJavascript(
                        "if (window.onEntitlementUpdated) window.onEntitlementUpdated(${licenseManager.getEntitlementInfoJson()});",
                        null
                    )
                }
            }
        }

        @JavascriptInterface
        fun openPurchasePage() {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(LicenseConfig.PURCHASE_URL))
                activity.startActivity(intent)
            } catch (e: Exception) {
                // Ignore if browser not available
            }
        }
    }
}
