const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '..', '..', 'mobile');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [sharedRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(sharedRoot, 'node_modules'),
];

config.resolver.disableHierarchicalLookup = true;

config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      const local = path.resolve(projectRoot, 'node_modules', name);
      try { require.resolve(local); return local; } catch (e) {}
      return path.resolve(sharedRoot, 'node_modules', name);
    },
  }
);

module.exports = config;
