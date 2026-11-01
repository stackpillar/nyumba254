// Signs release builds with an upload key that lives OUTSIDE the repo.
// Set NK_KEYSTORE_PROPS to the path of a keystore.properties file (storeFile, storePassword, keyAlias, keyPassword).
// Without it, release builds fall back to the debug key so nothing secret is ever needed to compile.
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (g.includes('NK_KEYSTORE_PROPS')) return cfg;
    const loader = `
def nkProps = new Properties()
def nkPropsPath = System.getenv('NK_KEYSTORE_PROPS')
if (nkPropsPath && new File(nkPropsPath).exists()) { new File(nkPropsPath).withInputStream { nkProps.load(it) } }
`;
    g = g.replace(/android\s*\{/, `${loader}\nandroid {`);
    g = g.replace(/signingConfigs\s*\{/, `signingConfigs {
        release {
            if (nkProps.getProperty('storeFile')) {
                storeFile file(nkProps.getProperty('storeFile'))
                storePassword nkProps.getProperty('storePassword')
                keyAlias nkProps.getProperty('keyAlias')
                keyPassword nkProps.getProperty('keyPassword')
            }
        }`);
    g = g.replace(/(release\s*\{[^}]*?)signingConfig signingConfigs\.debug/, `$1signingConfig (nkProps.getProperty('storeFile') ? signingConfigs.release : signingConfigs.debug)`);
    cfg.modResults.contents = g;
    return cfg;
  });
};
