import { Env } from '@tsed/core';
import {
  Configuration, Inject, PlatformApplication, Value, Constant,
} from '@tsed/common';

import express from 'express';
import expressBunyanLoggerFactory from 'express-bunyan-logger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import methodOverride from 'method-override';

import mongoose from 'mongoose';

import loggerFactory, { determineLogLevel } from '~/utils/logger';
import streamForExpressLogger from '~/utils/logger/stream';
import { SafeRedirectMiddleware } from './middlewares/safe-redirect';
import { getMongoUri, mongoOptions } from './util/mongoose-utils';

import { NextCtrl } from './controllers/next';

const rootDir = __dirname;
const logger = loggerFactory('growi:Server');

const acceptMimes = process.env.NODE_ENV === Env.PROD
  ? ['application/json']
  : ['application/json', 'text/event-stream'];

@Configuration({
  rootDir,
  port: process.env.PORT || 3000,
  httpsPort: false,
  acceptMimes,
  // disable RequestLogger of @tsed/logger
  logger: {
    logRequest: false,
  },
  componentsScan: [
    /* eslint-disable no-template-curly-in-string */
    '${rootDir}/middlewares/**/*.ts',
    '${rootDir}/service/**/*.ts',
    /* eslint-enable no-template-curly-in-string */
  ],
  mount: {
    '/': [
      NextCtrl,
    ],
  },
  mongoose: [ // @tsed/mongoose format configuration
    {
      id: 'default',
      url: getMongoUri(),
      connectionOptions: mongoOptions,
    },
  ],
})
export class Server {

  @Inject()
  private app!: PlatformApplication<Express.Application>;

  @Constant('env')
  private env!: Env;

  @Value('mongoose')
  private mongooseConfig!: any[];

  $beforeInit(): void | Promise<any> {
    return this.initMongoose();
  }

  /**
   * This method let you configure the express middleware required by your application to works.
   * @returns {Server}
   */
  public $beforeRoutesInit(): void | Promise<any> {
    this.app
      // .use(helmet())
      .use(cookieParser())
      .use(methodOverride())
      .use(express.json({ limit: '50mb' }))
      .use(express.urlencoded({ extended: true, limit: '50mb' }))
      .use(SafeRedirectMiddleware);

    const { raw: expressApp } = this.app;
    this.setupLogger(expressApp);
    this.setupSession(expressApp);
  }


  private initMongoose(): Promise<typeof mongoose> {
    // initialize mongoose without @tsed/mongoose
    //  because mongoose.model() does not work when using @tsed/mongoose
    const { url, connectionOptions } = this.mongooseConfig[0];
    return mongoose.connect(url, connectionOptions);
  }


  /**
   * Setup logger for requests
   * @param app
   */
  private setupLogger(app: Express.Application): void {
    const isProd = this.env === Env.PROD;

    // use bunyan
    if (isProd) {
      const level = determineLogLevel('express');

      app.use(expressBunyanLoggerFactory({
        name: 'express',
        streams: [{
          level,
          stream: streamForExpressLogger,
        }],
        excludes: ['*'],
      }));
    }
    // use morgan
    else {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const morgan = require('morgan');
      app.use(morgan('dev'));
    }
  }


  /**
   * Setup session
   * @param app
   */
  private setupSession(app: Express.Application): void {
    logger.info('Setup session');
  }

}
