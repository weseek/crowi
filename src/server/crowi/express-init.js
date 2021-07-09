
module.exports = function(crowi, app) {
  const debug = require('debug')('growi:crowi:express-init');
  const path = require('path');
  const express = require('express');
  const helmet = require('helmet');
  const bodyParser = require('body-parser');
  const cookieParser = require('cookie-parser');
  const methodOverride = require('method-override');
  const passport = require('passport');
  const expressSession = require('express-session');
  const flash = require('connect-flash');
  const mongoSanitize = require('express-mongo-sanitize');
  const swig = require('swig-templates');
  const webpackAssets = require('express-webpack-assets');
  const i18next = require('i18next');
  const i18nFsBackend = require('i18next-node-fs-backend');
  const i18nSprintf = require('i18next-sprintf-postprocessor');
  const i18nMiddleware = require('i18next-express-middleware');

  const promster = require('../middlewares/promster')(crowi, app);
  const registerSafeRedirect = require('../middlewares/safe-redirect')();
  const injectCurrentuserToLocalvars = require('../middlewares/inject-currentuser-to-localvars')();
  const autoReconnectToS2sMsgServer = require('../middlewares/auto-reconnect-to-s2s-msg-server')(crowi);
  const { listLocaleIds } = require('@commons/util/locale-utils');

  const avoidSessionRoutes = require('../routes/avoid-session-routes');
  const i18nUserSettingDetector = require('../util/i18nUserSettingDetector');

  const env = crowi.node_env;

  const lngDetector = new i18nMiddleware.LanguageDetector();
  lngDetector.addDetector(i18nUserSettingDetector);

  i18next
    .use(lngDetector)
    .use(i18nFsBackend)
    .use(i18nSprintf)
    .init({
      // debug: true,
      fallbackLng: ['en_US'],
      whitelist: listLocaleIds(),
      backend: {
        loadPath: `${crowi.localeDir}{{lng}}/translation.json`,
      },
      detection: {
        order: ['userSettingDetector', 'header', 'navigator'],
      },
      overloadTranslationOptionHandler: i18nSprintf.overloadTranslationOptionHandler,

      // change nsSeparator from ':' to '::' because ':' is used in config keys and these are used in i18n keys
      nsSeparator: '::',
    });

  app.use(helmet());

  app.use((req, res, next) => {
    const now = new Date();
    // for datez

    const Page = crowi.model('Page');
    const User = crowi.model('User');
    const Config = crowi.model('Config');
    app.set('tzoffset', crowi.appService.getTzoffset());

    req.csrfToken = null;

    res.locals.req = req;
    res.locals.baseUrl = crowi.appService.getSiteUrl();
    res.locals.env = env;
    res.locals.now = now;
    res.locals.consts = {
      pageGrants: Page.getGrantLabels(),
      userStatus: User.getUserStatusLabels(),
      language:   listLocaleIds(),
      restrictGuestMode: crowi.aclService.getRestrictGuestModeLabels(),
      registrationMode: crowi.aclService.getRegistrationModeLabels(),
    };
    res.locals.local_config = Config.getLocalconfig(); // config for browser context

    next();
  });

  app.set('port', crowi.port);
  const staticOption = (crowi.node_env === 'production') ? { maxAge: '30d' } : {};
  app.use(express.static(crowi.publicDir, staticOption));
  app.engine('html', swig.renderFile);
  app.use(webpackAssets(
    path.join(crowi.publicDir, 'manifest.json'),
    { devMode: (crowi.node_env === 'development') },
  ));
  // app.set('view cache', false);  // Default: true in production, otherwise undefined. -- 2017.07.04 Yuki Takei
  app.set('view engine', 'html');
  app.set('views', crowi.viewsDir);
  app.use(methodOverride());
  app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(cookieParser());

  // configure express-session
  const sessionMiddleware = expressSession(crowi.sessionConfig);
  app.use((req, res, next) => {
    // test whether the route is listed in avoidSessionRoutes
    for (const regex of avoidSessionRoutes) {
      if (regex.test(req.path)) {
        return next();
      }
    }

    sessionMiddleware(req, res, next);
  });

  // passport
  debug('initialize Passport');
  app.use(passport.initialize());
  app.use(passport.session());

  app.use(flash());
  app.use(mongoSanitize());

  app.use(promster);
  app.use(registerSafeRedirect);
  app.use(injectCurrentuserToLocalvars);
  app.use(autoReconnectToS2sMsgServer);

  const middlewares = require('../util/middlewares')(crowi, app);
  app.use(middlewares.swigFilters(swig));
  app.use(middlewares.swigFunctions());
  app.use(middlewares.csrfKeyGenerator());

  app.use(i18nMiddleware.handle(i18next));
};
