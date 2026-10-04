package com.allornothing.game

import android.content.Context
import android.speech.tts.TextToSpeech
import android.util.Log
import java.util.Locale

class TextToSpeechManager(context: Context) : TextToSpeech.OnInitListener {

    private val TAG = "TextToSpeechManager"
    private var tts: TextToSpeech? = null
    private var isInitialized = false
    private var isEnabled = true
    private var currentLangCode: String = "he"

    init {
        try {
            tts = TextToSpeech(context.applicationContext, this)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize TextToSpeech", e)
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val ttsEngine = tts
            if (ttsEngine != null) {
                applyLanguage(currentLangCode)
                isInitialized = true
                Log.d(TAG, "TextToSpeech initialized successfully")
            }
        } else {
            Log.e(TAG, "TextToSpeech initialization failed with status: $status")
            isInitialized = false
        }
    }

    fun setLanguage(langCode: String) {
        currentLangCode = langCode.lowercase().trim()
        if (isInitialized) {
            applyLanguage(currentLangCode)
        }
    }

    private fun applyLanguage(langCode: String) {
        val ttsEngine = tts ?: return
        try {
            val primaryLocale = when {
                langCode.startsWith("en") -> Locale.US
                langCode.startsWith("ru") -> Locale("ru", "RU")
                else -> Locale("he", "IL")
            }
            val result = ttsEngine.setLanguage(primaryLocale)
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                val fallbackLocale = when {
                    langCode.startsWith("en") -> Locale.ENGLISH
                    langCode.startsWith("ru") -> Locale("ru")
                    else -> Locale("he")
                }
                ttsEngine.setLanguage(fallbackLocale)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error applying language to TTS: $langCode", e)
        }
    }

    fun speak(text: String) {
        if (!isEnabled || !isInitialized) return
        val ttsEngine = tts ?: return
        try {
            ttsEngine.speak(text, TextToSpeech.QUEUE_ADD, null, "ALL_OR_NOTHING_TTS")
        } catch (e: Exception) {
            Log.e(TAG, "Error during TTS speak", e)
        }
    }

    fun stop() {
        try {
            tts?.stop()
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping TTS", e)
        }
    }

    fun setEnabled(enabled: Boolean) {
        isEnabled = enabled
        if (!enabled) {
            stop()
        }
    }

    fun shutdown() {
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (e: Exception) {
            Log.e(TAG, "Error shutting down TTS", e)
        } finally {
            tts = null
            isInitialized = false
        }
    }
}
