// Android release-build fixes for @stripe/stripe-react-native >= 0.81.
//
// Stripe declares com.stripe:stripe-android-issuing-push-provisioning as
// compileOnly: it never ships in the APK (we don't use Stripe Issuing push
// provisioning, i.e. adding cards to Google Wallet), but two release steps
// still trip over it:
//
// 1. Lint. AGP's lintVitalAnalyzeRelease resolves the library, and its
//    transitive dependency com.google.android.gms:play-services-tapandpay is
//    not published to any public Maven repo ("Could not find
//    play-services-tapandpay"). Lint isn't needed to produce the APK, so it is
//    skipped on release builds.
// 2. R8. Stripe's bridge code references com.stripe.android.pushProvisioning.*
//    classes that aren't on the classpath, and R8 fails on missing classes.
//    -dontwarn tells R8 they are intentionally absent.
const { withAppBuildGradle, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "with-stripe-android-fixes";

const withDisableReleaseLint = (config) =>
  withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes(MARKER)) {
      config.modResults.contents += `
// ${MARKER}
android {
    lint {
        checkReleaseBuilds false
        abortOnError false
    }
}
`;
    }
    return config;
  });

const withPushProvisioningProguardRules = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, "app", "proguard-rules.pro");
      const contents = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
      if (!contents.includes(MARKER)) {
        fs.writeFileSync(
          file,
          `${contents}\n# ${MARKER}\n-dontwarn com.stripe.android.pushProvisioning.**\n`
        );
      }
      return config;
    },
  ]);

module.exports = function withStripeAndroidFixes(config) {
  return withPushProvisioningProguardRules(withDisableReleaseLint(config));
};
