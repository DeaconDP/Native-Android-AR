plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "io.worldbuild.nativear"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.worldbuild.nativear"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        val twaUrl = (project.findProperty("TWA_URL") as String?) ?: "https://localhost:5187"
        val twaSite = twaUrlToSite(twaUrl)
        val assetStatements =
            """[{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"web","site":"$twaSite"}}]"""

        buildConfigField("String", "TWA_URL", "\"$twaUrl\"")
        resValue("string", "twa_url", twaUrl)
        // Escape quotes so AGP writes a valid strings.xml entry for TWA meta-data.
        resValue("string", "asset_statements", assetStatements.replace("\"", "\\\""))
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }

    buildFeatures {
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.browser:browser:1.8.0")
    implementation("androidx.core:core-ktx:1.15.0")
}

fun twaUrlToSite(twaUrl: String): String {
    val trimmed = twaUrl.trim().substringBefore("#").substringBefore("?")
    val schemeSep = trimmed.indexOf("://")
    require(schemeSep > 0) {
        "TWA_URL must be an absolute https URL, got: $twaUrl"
    }
    val scheme = trimmed.substring(0, schemeSep)
    val authority = trimmed.substring(schemeSep + 3).substringBefore("/")
    require(authority.isNotBlank()) {
        "TWA_URL must be an absolute https URL, got: $twaUrl"
    }
    return "$scheme://$authority"
}
