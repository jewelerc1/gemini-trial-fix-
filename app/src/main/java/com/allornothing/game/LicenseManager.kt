package com.allornothing.game

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.Executors

enum class EntitlementState {
    FREE_TRIAL,
    PAID,
    OWNER,
    LOCKED
}

class LicenseManager(private val context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("license_prefs", Context.MODE_PRIVATE)
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    val installationId: String by lazy { initInstallationId() }
    val deviceLabel: String by lazy { "${Build.MANUFACTURER} ${Build.MODEL}".trim() }

    companion object {
        private const val KEY_INSTALLATION_ID = "installation_id"
        private const val KEY_LICENSE_CODE = "license_code"
        private const val KEY_LICENSE_TOKEN = "license_token"
        private const val KEY_LICENSE_TYPE = "license_type"
        private const val KEY_LAST_VALIDATION_TIME = "last_validation_time"
        private const val KEY_RECHECK_AFTER_DAYS = "recheck_after_days"
        private const val KEY_TRIAL_TURNS_USED = "trial_turns_used"
        private const val KEY_TRIAL_REMAINING_TURNS = "trial_remaining_turns"
        private const val KEY_TRIAL_MAX_TURNS = "trial_max_turns"
        private const val KEY_TRIAL_ALLOWED = "trial_allowed"
        private const val KEY_LAST_COMMITTED_TURN_ID = "last_committed_turn_id"
        private const val KEY_CACHED_STATE = "cached_entitlement_state"
    }

    private fun initInstallationId(): String {
        val existing = prefs.getString(KEY_INSTALLATION_ID, null)
        if (!existing.isNullOrBlank()) {
            return existing
        }

        var rawId = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        if (rawId.isNullOrBlank() || rawId.equals("9774d56d682e549c", ignoreCase = true)) {
            rawId = UUID.randomUUID().toString()
        }

        val hashed = sha256("all_or_nothing_$rawId")
        prefs.edit().putString(KEY_INSTALLATION_ID, hashed).apply()
        return hashed
    }

    private fun sha256(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    @Synchronized
    fun getEntitlementState(): EntitlementState {
        val token = prefs.getString(KEY_LICENSE_TOKEN, null)
        if (!token.isNullOrBlank()) {
            val type = prefs.getString(KEY_LICENSE_TYPE, "customer")?.lowercase()
            if (type == "owner") {
                return EntitlementState.OWNER
            }

            val lastVal = prefs.getLong(KEY_LAST_VALIDATION_TIME, 0L)
            val recheckDays = prefs.getInt(KEY_RECHECK_AFTER_DAYS, 7).toLong()
            val windowMs = recheckDays * 24L * 60L * 60L * 1000L
            val elapsed = System.currentTimeMillis() - lastVal

            if (lastVal > 0L && elapsed <= windowMs) {
                return EntitlementState.PAID
            }

            // Outside 7-day offline window: lock until validated
            val cached = prefs.getString(KEY_CACHED_STATE, null)
            return if (cached == EntitlementState.PAID.name) {
                // If recently expired, request background validation
                EntitlementState.LOCKED
            } else {
                EntitlementState.LOCKED
            }
        }

        // Free trial check
        val allowed = prefs.getBoolean(KEY_TRIAL_ALLOWED, true)
        val turnsUsed = prefs.getInt(KEY_TRIAL_TURNS_USED, 0)
        val maxTurns = prefs.getInt(KEY_TRIAL_MAX_TURNS, LicenseConfig.MAX_TRIAL_TURNS)

        if (!allowed || turnsUsed >= maxTurns) {
            return EntitlementState.LOCKED
        }

        return EntitlementState.FREE_TRIAL
    }

    fun getEntitlementInfoJson(): JSONObject {
        val state = getEntitlementState()
        return JSONObject().apply {
            put("state", state.name)
            put("installation_id", installationId)
            put("device_label", deviceLabel)
            put("turns_used", prefs.getInt(KEY_TRIAL_TURNS_USED, 0))
            put("max_turns", prefs.getInt(KEY_TRIAL_MAX_TURNS, LicenseConfig.MAX_TRIAL_TURNS))
            put("remaining_turns", prefs.getInt(KEY_TRIAL_REMAINING_TURNS, LicenseConfig.MAX_TRIAL_TURNS))
            put("intensity_cap", if (state == EntitlementState.FREE_TRIAL) "touch" else "none")
            put("license_code", prefs.getString(KEY_LICENSE_CODE, "") ?: "")
            put("license_type", prefs.getString(KEY_LICENSE_TYPE, "") ?: "")
            put("is_offline_allowed", state == EntitlementState.PAID || state == EntitlementState.OWNER)
        }
    }

    fun onColdLaunch(onComplete: ((EntitlementState) -> Unit)? = null) {
        executor.execute {
            val token = prefs.getString(KEY_LICENSE_TOKEN, null)
            if (!token.isNullOrBlank()) {
                validateLicenseInternal { _, state ->
                    mainHandler.post { onComplete?.invoke(state) }
                }
            } else {
                checkTrialStatusInternal { _, state, _, _ ->
                    mainHandler.post { onComplete?.invoke(state) }
                }
            }
        }
    }

    fun activateLicense(
        licenseCode: String,
        callback: (success: Boolean, errorCode: String, state: EntitlementState) -> Unit
    ) {
        val trimmedCode = licenseCode.trim()
        if (trimmedCode.isBlank()) {
            mainHandler.post { callback(false, "INVALID_LICENSE", getEntitlementState()) }
            return
        }

        executor.execute {
            try {
                val payload = JSONObject().apply {
                    put("license_code", trimmedCode)
                    put("installation_id", installationId)
                    put("device_label", deviceLabel)
                }

                val (code, responseStr) = sendPostRequest(LicenseConfig.ACTIVATE_URL, payload.toString())
                val json = if (responseStr.isNotBlank()) JSONObject(responseStr) else JSONObject()

                if (code in 200..299 && json.optBoolean("active", false)) {
                    val token = json.optString("license_token", "")
                    val type = json.optString("license_type", "customer")
                    val recheckDays = json.optInt("recheck_after_days", 7)

                    prefs.edit()
                        .putString(KEY_LICENSE_CODE, trimmedCode)
                        .putString(KEY_LICENSE_TOKEN, token)
                        .putString(KEY_LICENSE_TYPE, type)
                        .putLong(KEY_LAST_VALIDATION_TIME, System.currentTimeMillis())
                        .putInt(KEY_RECHECK_AFTER_DAYS, recheckDays)
                        .putString(KEY_CACHED_STATE, if (type.lowercase() == "owner") EntitlementState.OWNER.name else EntitlementState.PAID.name)
                        .apply()

                    val newState = getEntitlementState()
                    mainHandler.post { callback(true, "SUCCESS", newState) }
                } else {
                    val err = json.optString("error", json.optString("code", "INVALID_LICENSE"))
                    mainHandler.post { callback(false, err, getEntitlementState()) }
                }
            } catch (e: Exception) {
                mainHandler.post { callback(false, "SERVER_ERROR", getEntitlementState()) }
            }
        }
    }

    fun validateLicense(callback: (success: Boolean, state: EntitlementState) -> Unit) {
        executor.execute {
            validateLicenseInternal { success, state ->
                mainHandler.post { callback(success, state) }
            }
        }
    }

    private fun validateLicenseInternal(callback: (Boolean, EntitlementState) -> Unit) {
        val token = prefs.getString(KEY_LICENSE_TOKEN, null)
        if (token.isNullOrBlank()) {
            callback(false, getEntitlementState())
            return
        }

        try {
            val payload = JSONObject().apply {
                put("license_token", token)
                put("installation_id", installationId)
            }

            val (code, responseStr) = sendPostRequest(LicenseConfig.VALIDATE_URL, payload.toString())
            val json = if (responseStr.isNotBlank()) JSONObject(responseStr) else JSONObject()

            if (code in 200..299 && json.optBoolean("active", false)) {
                val recheckDays = json.optInt("recheck_after_days", 7)
                val fallbackType = prefs.getString(KEY_LICENSE_TYPE, "customer") ?: "customer"
                val type = json.optString("license_type", fallbackType)
                prefs.edit()
                    .putString(KEY_LICENSE_TYPE, type)
                    .putLong(KEY_LAST_VALIDATION_TIME, System.currentTimeMillis())
                    .putInt(KEY_RECHECK_AFTER_DAYS, recheckDays)
                    .putString(KEY_CACHED_STATE, if (type.lowercase() == "owner") EntitlementState.OWNER.name else EntitlementState.PAID.name)
                    .apply()

                callback(true, getEntitlementState())
            } else {
                // If invalid/suspended/revoked/expired, switch to LOCKED
                prefs.edit().putString(KEY_CACHED_STATE, EntitlementState.LOCKED.name).apply()
                callback(false, EntitlementState.LOCKED)
            }
        } catch (e: Exception) {
            // Offline tolerance: check 7-day window
            val currentState = getEntitlementState()
            callback(currentState == EntitlementState.PAID || currentState == EntitlementState.OWNER, currentState)
        }
    }

    fun checkTrialStatus(callback: (success: Boolean, state: EntitlementState, turnsUsed: Int, remainingTurns: Int) -> Unit) {
        executor.execute {
            checkTrialStatusInternal { success, state, used, remaining ->
                mainHandler.post { callback(success, state, used, remaining) }
            }
        }
    }

    private fun checkTrialStatusInternal(callback: (Boolean, EntitlementState, Int, Int) -> Unit) {
        try {
            val payload = JSONObject().apply {
                put("installation_id", installationId)
                put("app_version", LicenseConfig.APP_VERSION)
            }

            val (code, responseStr) = sendPostRequest(LicenseConfig.TRIAL_STATUS_URL, payload.toString())
            val json = if (responseStr.isNotBlank()) JSONObject(responseStr) else JSONObject()

            if (code in 200..299) {
                val allowed = json.optBoolean("allowed", true)
                val turnsUsed = json.optInt("turns_used", 0)
                val maxTurns = json.optInt("max_turns", LicenseConfig.MAX_TRIAL_TURNS)
                val remaining = json.optInt("remaining_turns", maxTurns - turnsUsed)

                prefs.edit()
                    .putBoolean(KEY_TRIAL_ALLOWED, allowed && (turnsUsed < maxTurns))
                    .putInt(KEY_TRIAL_TURNS_USED, turnsUsed)
                    .putInt(KEY_TRIAL_MAX_TURNS, maxTurns)
                    .putInt(KEY_TRIAL_REMAINING_TURNS, remaining)
                    .apply()

                val state = getEntitlementState()
                callback(true, state, turnsUsed, remaining)
            } else {
                val state = getEntitlementState()
                val used = prefs.getInt(KEY_TRIAL_TURNS_USED, 0)
                val remaining = prefs.getInt(KEY_TRIAL_REMAINING_TURNS, 20)
                callback(false, state, used, remaining)
            }
        } catch (e: Exception) {
            val state = getEntitlementState()
            val used = prefs.getInt(KEY_TRIAL_TURNS_USED, 0)
            val remaining = prefs.getInt(KEY_TRIAL_REMAINING_TURNS, 20)
            callback(false, state, used, remaining)
        }
    }

    fun commitTrialTurn(
        turnId: String,
        callback: (allowed: Boolean, showPaywall: Boolean, remainingTurns: Int) -> Unit
    ) {
        val state = getEntitlementState()
        // PAID and OWNER bypass trial limits completely
        if (state == EntitlementState.PAID || state == EntitlementState.OWNER) {
            mainHandler.post { callback(true, false, 9999) }
            return
        }

        // Anti-double-count: check if this exact turn was already committed
        val lastCommitted = prefs.getString(KEY_LAST_COMMITTED_TURN_ID, null)
        if (!turnId.isBlank() && turnId == lastCommitted) {
            val remaining = prefs.getInt(KEY_TRIAL_REMAINING_TURNS, 0)
            mainHandler.post { callback(true, false, remaining) }
            return
        }

        executor.execute {
            try {
                val payload = JSONObject().apply {
                    put("installation_id", installationId)
                    put("app_version", LicenseConfig.APP_VERSION)
                }

                val (code, responseStr) = sendPostRequest(LicenseConfig.TRIAL_TURN_URL, payload.toString())
                val json = if (responseStr.isNotBlank()) JSONObject(responseStr) else JSONObject()

                if (code in 200..299) {
                    val turnAllowed = json.optBoolean("turn_allowed", true)
                    val showPaywall = json.optBoolean("show_paywall", false)
                    val turnsUsed = json.optInt("turns_used", prefs.getInt(KEY_TRIAL_TURNS_USED, 0) + 1)
                    val maxTurns = json.optInt("max_turns", LicenseConfig.MAX_TRIAL_TURNS)
                    val remaining = json.optInt("remaining_turns", maxTurns - turnsUsed)

                    prefs.edit()
                        .putString(KEY_LAST_COMMITTED_TURN_ID, turnId)
                        .putInt(KEY_TRIAL_TURNS_USED, turnsUsed)
                        .putInt(KEY_TRIAL_MAX_TURNS, maxTurns)
                        .putInt(KEY_TRIAL_REMAINING_TURNS, remaining)
                        .putBoolean(KEY_TRIAL_ALLOWED, turnAllowed && !showPaywall && remaining > 0)
                        .apply()

                    val paywallNeeded = showPaywall || !turnAllowed || remaining <= 0
                    mainHandler.post { callback(turnAllowed, paywallNeeded, remaining) }
                } else {
                    // Fallback local counting to prevent trial bypass if network drops
                    val curUsed = prefs.getInt(KEY_TRIAL_TURNS_USED, 0) + 1
                    val maxTurns = prefs.getInt(KEY_TRIAL_MAX_TURNS, LicenseConfig.MAX_TRIAL_TURNS)
                    val rem = (maxTurns - curUsed).coerceAtLeast(0)

                    prefs.edit()
                        .putString(KEY_LAST_COMMITTED_TURN_ID, turnId)
                        .putInt(KEY_TRIAL_TURNS_USED, curUsed)
                        .putInt(KEY_TRIAL_REMAINING_TURNS, rem)
                        .putBoolean(KEY_TRIAL_ALLOWED, curUsed < maxTurns)
                        .apply()

                    val paywallNeeded = curUsed >= maxTurns
                    mainHandler.post { callback(curUsed <= maxTurns, paywallNeeded, rem) }
                }
            } catch (e: Exception) {
                // Local counting fallback
                val curUsed = prefs.getInt(KEY_TRIAL_TURNS_USED, 0) + 1
                val maxTurns = prefs.getInt(KEY_TRIAL_MAX_TURNS, LicenseConfig.MAX_TRIAL_TURNS)
                val rem = (maxTurns - curUsed).coerceAtLeast(0)

                prefs.edit()
                    .putString(KEY_LAST_COMMITTED_TURN_ID, turnId)
                    .putInt(KEY_TRIAL_TURNS_USED, curUsed)
                    .putInt(KEY_TRIAL_REMAINING_TURNS, rem)
                    .putBoolean(KEY_TRIAL_ALLOWED, curUsed < maxTurns)
                    .apply()

                val paywallNeeded = curUsed >= maxTurns
                mainHandler.post { callback(curUsed <= maxTurns, paywallNeeded, rem) }
            }
        }
    }

    private fun sendPostRequest(urlString: String, jsonBody: String): Pair<Int, String> {
        val url = URL(urlString)
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 8000
            readTimeout = 8000
            doOutput = true
            doInput = true
            setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            setRequestProperty("apikey", LicenseConfig.SUPABASE_ANON_KEY)
            setRequestProperty("Authorization", "Bearer ${LicenseConfig.SUPABASE_ANON_KEY}")
        }

        OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
            writer.write(jsonBody)
            writer.flush()
        }

        val responseCode = conn.responseCode
        val stream = if (responseCode in 200..299) conn.inputStream else conn.errorStream
        val responseBody = stream?.let {
            BufferedReader(InputStreamReader(it, Charsets.UTF_8)).use { reader -> reader.readText() }
        } ?: ""

        conn.disconnect()
        return Pair(responseCode, responseBody)
    }
}
