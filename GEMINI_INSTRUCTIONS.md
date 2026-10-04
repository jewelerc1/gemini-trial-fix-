# Instructions for Gemini / Google AI Studio

Build a real Android application from the files in this repository.

IMPORTANT:
The provided `index.html` is the source of truth for the entire game UI and logic.

Do NOT redesign the game.
Do NOT recreate the game in Jetpack Compose.
Do NOT rebuild the board, wheel, dice, buttons, player panels, dialogs, or any other UI natively.

## Required architecture

1. Create a standard Android application in Kotlin.
2. Copy these files unchanged into:
   `app/src/main/assets/`
   - `index.html`
   - `board_scene.png`
   - `wheel_disc.png`
3. `MainActivity` must contain a fullscreen Android WebView.
4. Load:
   `file:///android_asset/index.html`
5. Enable JavaScript and DOM storage.
6. Do not modify the HTML/CSS/JavaScript except where strictly necessary to connect speech to native Android TTS.

## Visual requirements

7. The app must visually match the repository's `index.html`.
8. Do not alter colors, spacing, fonts, board design, wheel design, or assets.
9. Do not replace any existing UI with native Android widgets.
10. Board labels must remain inside their squares and centered.
11. Immunity and Extra Turn tiles must be centered.
12. Wheel labels must remain inside their segments.
13. Configure WebView so Android does not enlarge the HTML fonts.
14. Set:
   `webView.settings.textZoom = 100`
15. Keep fullscreen responsive behavior for phones and tablets.
16. No page scrolling during gameplay.
17. Support portrait and landscape.

## Native Hebrew TTS

18. Create a separate Kotlin class:
   `TextToSpeechManager`
19. Use Android native `TextToSpeech`.
20. Use Hebrew locale:
   `Locale("he", "IL")`
21. Initialize TTS asynchronously and safely.
22. If Hebrew TTS is unavailable, the app must continue without crashing.
23. Shut down TTS correctly in the Activity lifecycle.

## JavaScript bridge

24. Add a safe JavaScript interface named:
   `AndroidTTS`
25. Expose only:
   - `AndroidTTS.speak(text)`
   - `AndroidTTS.stop()`
   - `AndroidTTS.setEnabled(enabled)`
26. If the HTML currently uses browser `speechSynthesis`, adapt only the speech function so Android uses the native bridge.
27. Do not modify any other game logic.

## Preserve game behavior

28. Keep dice logic unchanged.
29. Keep wheel logic unchanged.
30. Keep player-selection rules unchanged.
31. Keep all questions and tasks unchanged.
32. Keep random behavior unchanged.
33. Keep copyright text unchanged.

## Testing

34. Run the app in the Android emulator before producing the final APK.
35. Verify:
   - app launches without crashing
   - visual appearance matches `index.html`
   - board labels fit
   - immunity and extra-turn tiles are centered
   - wheel labels fit
   - dice work
   - wheel works
   - Hebrew TTS works
   - restarting the app does not crash

If the emulator does not look like `index.html`, do NOT redesign the game.
Fix the WebView configuration instead.

Target: Android 16 / API 36
Test device: Samsung Galaxy S23+
