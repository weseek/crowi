const path = require('path');
const fs = require('graceful-fs');
const logger = require('@alias/logger')('growi:plugins:plugin-utils');
const packageInstalledVersionSync = require('package-installed-version-sync');

const PluginUtilsV2 = require('./plugin-utils-v2');

const pluginUtilsV2 = new PluginUtilsV2();

class PluginUtils {

  /**
   * return a definition objects that has following structure:
   *
   * {
   *   name: 'growi-plugin-X',
   *   meta: require('growi-plugin-X'),
   *   entries: [
   *     'growi-plugin-X/lib/client-entry'
   *   ]
   * }
   *
   * @param {string} pluginName
   * @return
   * @memberOf PluginService
   */
  generatePluginDefinition(name, isForClient = false) {
    const meta = require(name);
    let definition;

    switch (meta.pluginSchemaVersion) {
      // v1 is deprecated
      case 1:
        logger.debug('pluginSchemaVersion 1 is deprecated');
        break;
      // v2 or above
      case 2:
      default:
        definition = pluginUtilsV2.generatePluginDefinition(name, isForClient);
    }

    return definition;
  }

  /**
   * list plugin module objects
   *  that starts with 'growi-plugin-' or 'crowi-plugin-'
   * borrowing from: https://github.com/hexojs/hexo/blob/d1db459c92a4765620343b95789361cbbc6414c5/lib/hexo/load_plugins.js#L17
   *
   * @returns array of objects
   *   [
   *     { name: 'growi-plugin-...', requiredVersion: '^1.0.0', installedVersion: '1.0.0' },
   *     { name: 'growi-plugin-...', requiredVersion: '^1.0.0', installedVersion: '1.0.0' },
   *     ...
   *   ]
   *
   * @memberOf PluginService
   */
  listPlugins(rootDir) {
    const packagePath = path.join(rootDir, 'packages/app/package.json');

    // Make sure package.json exists
    if (!fs.existsSync(packagePath)) {
      return [];
    }

    // Read package.json and find dependencies
    const content = fs.readFileSync(packagePath);
    const json = JSON.parse(content);
    const deps = json.dependencies || {};

    const pluginNames = Object.keys(deps).filter((name) => {
      return /^(crowi|growi)-plugin-/.test(name);
    });

    return pluginNames.map((name) => {
      return {
        name,
        requiredVersion: deps[name],
        installedVersion: packageInstalledVersionSync(name),
      };
    });
  }

  /**
   * list plugin module names that starts with 'crowi-plugin-'
   *
   * @returns array of plugin names
   *
   * @memberOf PluginService
   */
  listPluginNames(rootDir) {
    const plugins = this.listPlugins(rootDir);
    return plugins.map((plugin) => { return plugin.name });
  }

}

module.exports = PluginUtils;
