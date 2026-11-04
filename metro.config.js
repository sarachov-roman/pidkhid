// Папку desktop (обгортка для Mac зі своїми node_modules) Metro пропускає.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const desktopDir = path.resolve(__dirname, 'desktop').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [new RegExp(`^${desktopDir}([\\\\/].*)?$`)];
module.exports = config;
