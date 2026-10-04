package com.allornothing.game

import android.content.Context
import android.os.Bundle
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class AppVerificationTest {

    @Test
    fun testAppLaunchesWithoutCrashing() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        assertNotNull("MainActivity should not be null", activity)
        assertTrue("MainActivity should not be finishing", !activity.isFinishing)
    }

    @Test
    @Config(qualifiers = "w393dp-h852dp-port-xxhdpi")
    fun testSamsungGalaxyS23PlusPortraitLayoutAndLongTaskOverlay() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        assertNotNull("MainActivity should not be null on Samsung Galaxy S23+", activity)
        assertTrue("MainActivity should be running on S23+ layout", !activity.isFinishing)

        val context = RuntimeEnvironment.getApplication()
        val htmlStream = context.assets.open("index.html")
        val content = htmlStream.reader().readText()
        htmlStream.close()

        assertTrue("Must include viewport-fit=cover", content.contains("viewport-fit=cover"))
        assertTrue("Modal must be position:fixed", content.contains(".modal{position:fixed") || content.contains("position:fixed!important"))
        assertTrue("Modal host must not be in normal document flow below board", content.contains(".bottom-message-host{position:fixed"))
        assertTrue("Modal backdrop must be fixed full-screen overlay", content.contains(".modal-back{position:fixed;inset:0"))
        assertTrue("Must center horizontally with left:50% and transform:translateX(-50%)",
            content.contains("left:50%") && content.contains("transform:translateX(-50%)"))
        assertTrue("Must keep above Android navigation bar with safe-area-inset-bottom",
            content.contains("calc(env(safe-area-inset-bottom"))
        assertTrue("Must set max-height to 45dvh", content.contains("45dvh"))
        assertTrue("Must set overflow-y:auto for long tasks", content.contains("overflow-y:auto"))
        assertTrue("Game page must remain non-scrollable", content.contains("overflow:hidden"))
        assertTrue("Must use responsive width min(92vw, 520px)", content.contains("min(92vw,520px)") || content.contains("min(92vw, 520px)"))
        assertTrue("Must support window.visualViewport calculation", content.contains("visualViewport"))
        assertTrue("Must update viewport layout on resize", content.contains("updateModalViewportLayout"))
    }

    @Test
    fun testAssetsAndNewContentIntegrity() {
        val context = RuntimeEnvironment.getApplication()
        val assetManager = context.assets
        val htmlStream = assetManager.open("index.html")
        val htmlContent = htmlStream.reader().readText()
        htmlStream.close()

        assertTrue("index.html should not be empty", htmlContent.isNotEmpty())
        assertTrue("index.html must contain board and wheel logic", htmlContent.contains("wheel") && htmlContent.contains("tile"))
        assertTrue("index.html must support AndroidTTS", htmlContent.contains("AndroidTTS"))
        assertTrue("Must contain dice logic", htmlContent.contains("rollDice"))
        assertTrue("Must contain wheel logic", htmlContent.contains("manualSpinWheel") || htmlContent.contains("spinWheel"))

        // Verify state persistence logic is present
        assertTrue("Must contain storage key allOrNothingGameStateV1", htmlContent.contains("allOrNothingGameStateV1"))
        assertTrue("Must contain saveGameState function", htmlContent.contains("function saveGameState()"))
        assertTrue("Must contain restoreSavedGameState function", htmlContent.contains("function restoreSavedGameState()"))
        assertTrue("Must contain clearSavedGameState function", htmlContent.contains("function clearSavedGameState()"))

        val boardStream = assetManager.open("board_scene.png")
        assertNotNull("board_scene.png must be present in assets", boardStream)
        assertTrue("board_scene.png must have bytes", boardStream.available() > 0)
        boardStream.close()

        val wheelStream = assetManager.open("wheel_disc.png")
        assertNotNull("wheel_disc.png must be present in assets", wheelStream)
        assertTrue("wheel_disc.png must have bytes", wheelStream.available() > 0)
        wheelStream.close()
    }

    @Test
    fun testMultilingualPackAndLanguageSelectorIntegrity() {
        val context = RuntimeEnvironment.getApplication()
        val assetManager = context.assets

        val langPackStream = assetManager.open("lang/all_or_nothing_languages_FINAL_he_en_ru.json")
        val jsonText = langPackStream.reader().readText()
        langPackStream.close()
        val langJson = JSONObject(jsonText)

        assertEquals("Phase must be 3", 3, langJson.getJSONObject("meta").getInt("phase"))
        assertEquals(150, langJson.getJSONArray("all_cards").length())
        assertEquals(150, langJson.getJSONArray("nothing_cards").length())
        assertEquals(150, langJson.getJSONArray("bold_cards").length())
        assertEquals(130, langJson.getJSONArray("pair_cards").length())
        assertEquals(30, langJson.getJSONObject("luck_events").length())

        val htmlStream = assetManager.open("index.html")
        val htmlContent = htmlStream.reader().readText()
        htmlStream.close()

        assertTrue("Opening screen must have Hebrew button", htmlContent.contains("id=\"btnChooseHe\"") && htmlContent.contains("עברית"))
        assertTrue("Opening screen must have English button", htmlContent.contains("id=\"btnChooseEn\"") && htmlContent.contains("English"))
        assertTrue("Opening screen must have Russian button", htmlContent.contains("id=\"btnChooseRu\"") && htmlContent.contains("Русский"))

        assertTrue("Must support setLanguage function", htmlContent.contains("function setLanguage(lang)"))
        assertTrue("Must support RTL for Hebrew", htmlContent.contains("document.documentElement.dir = 'rtl'") || htmlContent.contains("dir = 'rtl'"))
        assertTrue("Must support LTR for English and Russian", htmlContent.contains("document.documentElement.dir = 'ltr'") || htmlContent.contains("dir = 'ltr'"))
    }

    @Test
    fun testMultilingualTextToSpeechManager() {
        val context = RuntimeEnvironment.getApplication()
        val tts = TextToSpeechManager(context)
        assertNotNull("TTS Manager should initialize", tts)

        tts.setLanguage("he")
        tts.speak("שלום לכולם וברוכים הבאים למשחק הכל או כלום")

        tts.setLanguage("en")
        tts.speak("Welcome to All or Nothing")

        tts.setLanguage("ru")
        tts.speak("Добро пожаловать в игру Всё или ничего")

        tts.setEnabled(false)
        tts.speak("Muted test")
        tts.setEnabled(true)
        tts.stop()
        tts.shutdown()
    }

    @Test
    fun testSessionBehavior_TestA_TemporaryLeaveAndActivityRecreation() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val initialActivity = controller.get()
        assertNotNull("Initial activity should not be null", initialActivity)

        val outBundle = Bundle()
        controller.saveInstanceState(outBundle)
        assertTrue("Saved state bundle should not be empty", !outBundle.isEmpty)
        controller.pause().stop()

        val recreatedController = Robolectric.buildActivity(MainActivity::class.java)
            .create(outBundle)
            .start()
            .restoreInstanceState(outBundle)
            .resume()
        val recreatedActivity = recreatedController.get()
        assertNotNull("Recreated activity should not be null", recreatedActivity)
        assertFalse("Recreated activity should not be finishing", recreatedActivity.isFinishing)

        recreatedController.pause().stop().destroy()
    }

    @Test
    fun testSessionBehavior_TestB_ColdLaunchDoesNotResumeOldGame() {
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        assertNotNull("Activity on cold launch should not be null", activity)
        assertFalse("Activity should not be finishing", activity.isFinishing)

        val context = RuntimeEnvironment.getApplication()
        val htmlStream = context.assets.open("index.html")
        val content = htmlStream.reader().readText()
        htmlStream.close()

        assertTrue("Must contain cold launch detection", content.contains("isGenuineColdLaunch"))
        assertTrue("Cold launch must clear old state and show screenStart or screenLanguage",
            content.contains("clearSavedGameState()"));
    }

    @Test
    fun testPerPlayerCardHistoryWithStableCardIds() {
        val context = RuntimeEnvironment.getApplication()
        val htmlStream = context.assets.open("index.html")
        val content = htmlStream.reader().readText()
        htmlStream.close()

        assertTrue("Must support initPlayerDecks", content.contains("function initPlayerDecks()"))
        assertTrue("Must support drawPlayerNothingCard", content.contains("function drawPlayerNothingCard("))
        assertTrue("Must support drawPlayerAllCard", content.contains("function drawPlayerAllCard("))
        assertTrue("Must track 150 nothing cards by ID", content.contains("ALL_150_NOTHING_IDS"))
        assertTrue("Must retrieve card text in selected language", content.contains("function getCardText("))
    }

    // ==================== NEW ENTITLEMENT & TRIAL TESTS ====================

    @Test
    fun testLicenseManagerInstallationIdConsistency() {
        val context = RuntimeEnvironment.getApplication()
        val lm1 = LicenseManager(context)
        val id1 = lm1.installationId
        assertNotNull("Installation ID should not be null", id1)
        assertTrue("Installation ID must not be empty", id1.isNotBlank())
        assertEquals("Installation ID SHA-256 should be 64 hex characters", 64, id1.length)

        // Must remain consistent across calls and instances
        val lm2 = LicenseManager(context)
        val id2 = lm2.installationId
        assertEquals("Installation ID must be consistent across instances", id1, id2)
    }

    @Test
    fun testEntitlementStateDefaultAndPaidWindow() {
        val context = RuntimeEnvironment.getApplication()
        val lm = LicenseManager(context)
        
        // Clean state -> FREE_TRIAL
        assertEquals(EntitlementState.FREE_TRIAL, lm.getEntitlementState())

        val prefs = context.getSharedPreferences("license_prefs", Context.MODE_PRIVATE)

        // Test Paid within 7 days
        prefs.edit()
            .putString("license_token", "test_tok_123")
            .putString("license_type", "customer")
            .putLong("last_validation_time", System.currentTimeMillis())
            .putInt("recheck_after_days", 7)
            .apply()
        assertEquals(EntitlementState.PAID, lm.getEntitlementState())

        // Test Owner -> unlimited, always OWNER
        prefs.edit()
            .putString("license_type", "owner")
            .apply()
        assertEquals(EntitlementState.OWNER, lm.getEntitlementState())

        // Test Expired outside 7 days -> LOCKED
        prefs.edit()
            .putString("license_type", "customer")
            .putLong("last_validation_time", System.currentTimeMillis() - (8L * 24L * 60L * 60L * 1000L))
            .apply()
        assertEquals(EntitlementState.LOCKED, lm.getEntitlementState())
    }

    @Test
    fun testTrialTurnsMaxAndLockedWhenExhausted() {
        val context = RuntimeEnvironment.getApplication()
        val prefs = context.getSharedPreferences("license_prefs", Context.MODE_PRIVATE)
        prefs.edit().clear().apply()

        val lm = LicenseManager(context)
        assertEquals(EntitlementState.FREE_TRIAL, lm.getEntitlementState())

        // Set 20 turns used
        prefs.edit()
            .putInt("trial_turns_used", 20)
            .putInt("trial_max_turns", 20)
            .putInt("trial_remaining_turns", 0)
            .apply()

        assertEquals(EntitlementState.LOCKED, lm.getEntitlementState())
    }

    @Test
    fun testTrialHeatCapAndPaywallTextInAssets() {
        val context = RuntimeEnvironment.getApplication()
        val htmlStream = context.assets.open("index.html")
        val content = htmlStream.reader().readText()
        htmlStream.close()

        // 1. Structural trial heat cap at TOUCH (level 2)
        assertTrue("Must cap trial heat at TOUCH (2)",
            content.contains("if (entitlementState === 'FREE_TRIAL')") && content.contains("Math.min(lvl, 2)"))

        // 2. Paywall text strings required by spec
        // Hebrew
        assertTrue("Must contain Hebrew paywall title", content.contains("פתיחת המשחק המלא — 49.90 ₪"))
        assertTrue("Must contain Hebrew already purchased text", content.contains("כבר רכשתי / הפעל רישיון"))
        assertTrue("Must contain Hebrew trial ended text", content.contains("גרסת הניסיון הסתיימה. ניתן לפתוח את הגרסה המלאה ברכישה חד־פעמית."))

        // English
        assertTrue("Must contain English paywall title", content.contains("Unlock Full Game — ₪49.90"))
        assertTrue("Must contain English already purchased text", content.contains("Already purchased / Activate license"))

        // Russian
        assertTrue("Must contain Russian paywall title", content.contains("Открыть полную версию — 49,90 ₪"))
        assertTrue("Must contain Russian already purchased text", content.contains("Уже купили / Активировать лицензию"))

        // Anti-double-count turn commit
        assertTrue("Must call commitTrialTurn on turn commit", content.contains("commitTrialTurn"))
        assertTrue("Must block rollDice when LOCKED", content.contains("if (entitlementState === 'LOCKED') { showPaywallModal(); return; }"))
    }
    @Test
    fun testBrandingAndLauncherLabelIsEnglishAllOrNothing() {
        val context = RuntimeEnvironment.getApplication()
        val appName = context.getString(R.string.app_name)
        assertEquals("App display name / launcher label must be exactly 'All or Nothing'", "All or Nothing", appName)
    }

}
