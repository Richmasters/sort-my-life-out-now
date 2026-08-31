plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// CI run number, so every build is a distinct version. Without this every APK was
// versionCode 1, which makes an install a no-op update and leaves you unable to tell
// which build is actually on the phone.
val buildNumber = (System.getenv("GITHUB_RUN_NUMBER") ?: "0").toIntOrNull() ?: 0

android {
    namespace = "com.richmasters.finevolume"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.richmasters.finevolume"
        minSdk = 28
        targetSdk = 34
        versionCode = maxOf(buildNumber, 1)
        versionName = if (buildNumber > 0) "build " + buildNumber else "local"
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
}
