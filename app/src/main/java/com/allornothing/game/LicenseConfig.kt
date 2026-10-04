package com.allornothing.game

object LicenseConfig {
    const val SUPABASE_URL = "https://dhizmslltytrqrqdbrjn.supabase.co"
    const val ACTIVATE_URL = "$SUPABASE_URL/functions/v1/activate-license"
    const val VALIDATE_URL = "$SUPABASE_URL/functions/v1/validate-license"
    const val TRIAL_STATUS_URL = "$SUPABASE_URL/functions/v1/trial-status"
    const val TRIAL_TURN_URL = "$SUPABASE_URL/functions/v1/trial-turn"

    // Supabase publishable / anon key (safe for client-side inclusion)
    // Never hardcode SUPABASE_SERVICE_ROLE_KEY or any PayPlus secret in the APK!
    var SUPABASE_ANON_KEY: String = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.anon"

    const val PURCHASE_URL = "https://all-or-nothing.co.il/buy"
    const val APP_VERSION = "1.53.0"
    const val MAX_TRIAL_TURNS = 20
    const val VALIDATION_WINDOW_DAYS = 7L
}
