# Fine Volume

A 100-step master volume control for Android, because the stock one has about 15 steps
spread over ~55 dB and always lands either side of the level you wanted.

## The problem this is solving

`AudioManager.setStreamVolume()` takes an integer index between 0 and
`getStreamMaxVolume()`, which is 15 on most phones. An app cannot ask Android for more
steps — the step count lives in the platform's audio policy configuration, which needs
root to change. So a 100-position slider that only calls that API is cosmetic: it snaps
to the same 15 places with a prettier number over the top.

Real resolution needs a second gain stage stacked on the first:

| stage  | mechanism | resolution |
|--------|-----------|------------|
| coarse | `setStreamVolume` hardware index | ~4 dB per step |
| fine   | attenuation on audio session 0 (the global output mix) | continuous |

For any target level we take the lowest hardware step still *at or above* it, then trim
the remainder in software. The dB values are read from `getStreamVolumeDb()` per output
route rather than assumed, so the mapping is measured on your device, for your headphones.

The fine stage prefers `DynamicsProcessing`, whose input-gain stage is genuinely flat, and
falls back to an `Equalizer` with every band pinned to the same level, which is only
approximately flat but monotonic enough to be useful.

## The catch

Since Android 10, attaching an effect to session 0 has been gated behind
`MODIFY_AUDIO_SETTINGS_PRIVILEGED`. That is a signature-level permission — it cannot be
granted over ADB, and no settings toggle exposes it. Pixels enforce this strictly.

**Whether this app can do what it claims is therefore a per-device question**, which is
why the diagnostics screen exists and why it is the first thing to run.

Two further wrinkles, both Bluetooth-specific:

- With **A2DP hardware offload** active, audio bypasses the software mixer entirely, so
  the effect attaches successfully and then does nothing.
- With **absolute volume** on, the phone forwards a single index to the headset instead of
  attenuating locally.

Both have Developer Options toggles. The offload one needs a reboot.

## Testing it, in order

1. Install, open, tap **Diagnostics**.
2. Read the `FINE GAIN STAGE` section. If it says no backend attached, plan A is dead on
   this device and no amount of app-side work changes that.
3. If something did attach, start music playing and tap **Run audible test**. It drops the
   fine stage by 12 dB for three seconds *without touching the hardware index*. If the
   music dips and returns, the approach works end to end.
4. If it attached but you heard nothing, turn on *Disable Bluetooth A2DP hardware offload*
   in Developer Options, reboot, and repeat step 3.

A successful attach is necessary but not sufficient. Only step 3 settles it.

## If the fine stage is unavailable

The app degrades to a well-shaped control over the hardware steps you already have. It
picks the *nearest* step rather than rounding up, so it is not biased loud, and the slider
range is compressed into roughly the top 45 dB so the travel is spent where you listen
instead of on levels you will never use. Combined with volume-key capture this is a
meaningful improvement in aim, but it is not extra resolution, and the app says so plainly
on the diagnostics screen rather than pretending otherwise.

## Surfaces

- **App** — vertical bar, drag anywhere on it, plus 1% nudge buttons.
- **Notification** — persistent, with −/+ buttons. Tap *Show notification control*.
- **Volume keys** — an accessibility service consumes the rocker and applies 1% steps.
  Tap *Enable volume key capture*, then enable "Fine Volume key control" in the system
  accessibility settings. It reads no screen content; it only filters key events.

## Building

CI builds the debug APK on every push to the feature branch and attaches it to the
rolling `latest` prerelease. Open that link on the phone to sideload.

Locally: `cd android && ./gradlew assembleDebug` with any recent Android SDK.
