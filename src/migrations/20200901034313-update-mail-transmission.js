import mongoose from 'mongoose';

import config from '^/config/migrate';
import loggerFactory from '~/utils/logger';
import { getModelSafely } from '~/server/util/mongoose-utils';

const logger = loggerFactory('growi:migrate:update-mail-transmission');

module.exports = {
  async up(db, client) {
    logger.info('Apply migration');
    mongoose.connect(config.mongoUri, config.mongodb.options);

    const Config = getModelSafely('Config') || require('~/server/models/config')();

    const sesExist = await Config.findOne({
      ns: 'crowi',
      key: 'mail:sesAccessKeyId',
    });

    if (sesExist == null) {
      return logger.info('Document does not exist, value of transmission method will be set smtp automatically.');
    }
    const value = (
      sesExist.value != null ? 'ses' : 'smtp'
    );
    await Config.create({
      ns: 'crowi',
      key: 'mail:transmissionMethod',
      value,
    });
    logger.info('Migration has successfully applied');

  },

  async down(db, client) {
    logger.info('Rollback migration');
    mongoose.connect(config.mongoUri, config.mongodb.options);

    const Config = getModelSafely('Config') || require('~/server/models/config')();

    // remote 'mail:transmissionMethod'
    await Config.findOneAndDelete({
      ns: 'crowi',
      key: 'mail:transmissionMethod',
    });

    logger.info('Migration has been successfully rollbacked');
  },
};
