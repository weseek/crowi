/**
 * Configuration file for migrate-mongo
 * @see https://github.com/seppevs/migrate-mongo
 *
 * @author Yuki Takei <yuki@weseek.co.jp>
 */

const { URL } = require('url');

const { getMongoUri } = require('~/server/util/mongoose-utils');

const mongoUri = getMongoUri();

// parse url
const url = new URL(mongoUri);

const mongodb = {
  url: mongoUri,
  databaseName: url.pathname.substring(1), // omit heading slash
  options: {
    useNewUrlParser: true, // removes a deprecation warning when connecting
    useUnifiedTopology: true,
    useFindAndModify: false,
  },
};

module.exports = {
  mongoUri,
  mongodb,
  migrationsDir: 'src/migrations/',
  changelogCollectionName: 'migrations',
};
