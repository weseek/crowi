import bunyan, { LogLevel } from 'bunyan'; // will be replaced to browser-bunyan on browser by webpack
import minimatch from 'minimatch';

import { logger as configOfLogger } from '^/config';

import stream from './stream';

const isBrowser = typeof window !== 'undefined';
const isProd = process.env.NODE_ENV === 'production';

// logger store
interface BunyanStore {
  [key: string] : bunyan;
}
const loggers: BunyanStore = {};


// merge configuration from environment variables
interface EnvLevelMap {
  [key: string] : string;
}
const envLevelMap: EnvLevelMap = {
  INFO:   'info',
  DEBUG:  'debug',
  WARN:   'warn',
  TRACE:  'trace',
  ERROR:  'error',
};
Object.keys(envLevelMap).forEach((envName) => { // ['INFO', 'DEBUG', ...].forEach
  const envVars = process.env[envName]; // process.env.DEBUG should have a value like 'growi:routes:page,growi:models.page,...'
  if (envVars != null) {
    const level = envLevelMap[envName];
    envVars.split(',').forEach((ns) => { // ['growi:routes:page', 'growi:models.page', ...].forEach
      configOfLogger[ns.trim()] = level;
    });
  }
});

/**
 * determine logger level
 * @param name Logger name
 */
export function determineLogLevel(name: string): LogLevel {
  if (isBrowser && isProd) {
    return 'error';
  }

  let level: LogLevel = configOfLogger.default;

  /* eslint-disable array-callback-return, no-useless-return */
  // retrieve configured level
  Object.keys(configOfLogger).some((key) => { //  breakable forEach
    // test whether 'name' matches to 'key'(blob)
    if (minimatch(name, key)) {
      level = configOfLogger[key];
      return; //                          break if match
    }
  });

  return level;
}

const loggerFactory = function(name: string): bunyan {
  // create logger instance if absent
  if (loggers[name] == null) {
    loggers[name] = bunyan.createLogger({
      name,
      stream,
      level: determineLogLevel(name),
    });
  }

  return loggers[name];
};

export default loggerFactory;
