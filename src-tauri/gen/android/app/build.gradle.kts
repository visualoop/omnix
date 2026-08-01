import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

android {
    compileSdk = 35
    namespace = "co.ke.omnix.app"

    // Release signing. Credentials never live in the repository: CI decodes the
    // keystore from ANDROID_KEYSTORE_BASE64 and exports these variables, and a
    // maintainer can export the same four locally to produce an identical
    // signed build. When they are absent the release build stays unsigned so
    // ordinary development and CI dry runs still work.
    val omnixKeystorePath: String? = System.getenv("ANDROID_KEYSTORE_PATH")
    val omnixKeystorePassword: String? = System.getenv("ANDROID_KEYSTORE_PASSWORD")
    val omnixKeyAlias: String? = System.getenv("ANDROID_KEY_ALIAS")
    val omnixKeyPassword: String? = System.getenv("ANDROID_KEY_PASSWORD")
    val omnixSigningReady = !omnixKeystorePath.isNullOrBlank() &&
        !omnixKeystorePassword.isNullOrBlank() &&
        !omnixKeyAlias.isNullOrBlank() &&
        !omnixKeyPassword.isNullOrBlank() &&
        file(omnixKeystorePath).exists()

    if (omnixSigningReady) {
        signingConfigs {
            create("release") {
                storeFile = file(omnixKeystorePath!!)
                storePassword = omnixKeystorePassword
                keyAlias = omnixKeyAlias
                keyPassword = omnixKeyPassword
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "co.ke.omnix.app"
        minSdk = 28
        targetSdk = 35
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {
                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            if (omnixSigningReady) {
                signingConfig = signingConfigs.getByName("release")
            }
            isMinifyEnabled = true
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    implementation("com.wireguard.android:tunnel:1.0.20260102")
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("androidx.camera:camera-camera2:1.4.2")
    implementation("androidx.camera:camera-lifecycle:1.4.2")
    implementation("androidx.camera:camera-view:1.4.2")
    implementation("com.google.mlkit:barcode-scanning:17.3.0")
    implementation("androidx.work:work-runtime-ktx:2.10.1")
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")
