const express = require('express');
const mongoose = require('mongoose');
const urljoin = require('url-join');

const loggerFactory = require('@alias/logger');

const { verifySlackRequest, generateWebClient } = require('@growi/slack');

const logger = loggerFactory('growi:routes:apiv3:slack-integration');
const router = express.Router();
const SlackAppIntegration = mongoose.model('SlackAppIntegration');

module.exports = (crowi) => {
  this.app = crowi.express;

  const { configManager } = crowi;

  // Check if the access token is correct
  async function verifyAccessTokenFromProxy(req, res, next) {
    const tokenPtoG = req.headers['x-growi-ptog-tokens'];

    if (tokenPtoG == null) {
      const message = 'The value of header \'x-growi-ptog-tokens\' must not be empty.';
      logger.warn(message, { body: req.body });
      return res.status(400).send({ message });
    }

    const slackAppIntegrationCount = await SlackAppIntegration.countDocuments({ tokenPtoG });

    logger.debug('verifyAccessTokenFromProxy', {
      tokenPtoG,
      slackAppIntegrationCount,
    });

    if (slackAppIntegrationCount === 0) {
      return res.status(403).send({
        message: 'The access token that identifies the request source is slackbot-proxy is invalid. Did you setup with `/growi register`.\n'
        + 'Or did you delete registration for GROWI ? if so, the link with GROWI has been disconnected. '
        + 'Please unregister the information registered in the proxy and setup `/growi register` again.',
      });
    }

    next();
  }

  const addSigningSecretToReq = (req, res, next) => {
    req.slackSigningSecret = configManager.getConfig('crowi', 'slackbot:signingSecret');
    return next();
  };

  const generateClientForResponse = (tokenGtoP) => {
    const currentBotType = crowi.configManager.getConfig('crowi', 'slackbot:currentBotType');

    if (currentBotType == null) {
      throw new Error('The config \'SLACK_BOT_TYPE\'(ns: \'crowi\', key: \'slackbot:currentBotType\') must be set.');
    }

    let token;

    // connect directly
    if (tokenGtoP == null) {
      token = crowi.configManager.getConfig('crowi', 'slackbot:token');
      return generateWebClient(token);
    }

    // connect to proxy
    const proxyServerUri = crowi.configManager.getConfig('crowi', 'slackbot:proxyServerUri');
    const serverUri = urljoin(proxyServerUri, '/g2s');
    const headers = {
      'x-growi-gtop-tokens': tokenGtoP,
    };

    return generateWebClient(token, serverUri, headers);
  };

  async function handleCommands(req, res) {
    const { body } = req;

    if (body.text == null) {
      return 'No text.';
    }

    /*
     * TODO: use parseSlashCommand
     */

    // Send response immediately to avoid opelation_timeout error
    // See https://api.slack.com/apis/connections/events-api#the-events-api__responding-to-events
    res.send();

    const tokenPtoG = req.headers['x-growi-ptog-tokens'];

    // generate client
    let client;
    if (tokenPtoG == null) {
      client = generateClientForResponse();
    }
    else {
      const slackAppIntegration = await SlackAppIntegration.findOne({ tokenPtoG });
      client = generateClientForResponse(slackAppIntegration.tokenGtoP);
    }

    const args = body.text.split(' ');
    const command = args[0];

    try {
      await crowi.slackBotService.handleCommand(command, client, body, args);
    }
    catch (error) {
      logger.error(error);
    }
  }

  router.post('/commands', addSigningSecretToReq, verifySlackRequest, async(req, res) => {
    return handleCommands(req, res);
  });

  router.post('/proxied/commands', verifyAccessTokenFromProxy, async(req, res) => {
    const { body } = req;

    // eslint-disable-next-line max-len
    // see: https://api.slack.com/apis/connections/events-api#the-events-api__subscribing-to-event-types__events-api-request-urls__request-url-configuration--verification
    if (body.type === 'url_verification') {
      return res.send({ challenge: body.challenge });
    }

    return handleCommands(req, res);
  });


  const handleBlockActions = async(client, payload) => {
    const { action_id: actionId } = payload.actions[0];

    switch (actionId) {
      case 'shareSingleSearchResult': {
        await crowi.slackBotService.shareSinglePage(client, payload);
        break;
      }
      case 'dismissSearchResults': {
        await crowi.slackBotService.dismissSearchResults(client, payload);
        break;
      }
      case 'showNextResults': {
        const parsedValue = JSON.parse(payload.actions[0].value);

        const { body, args, offset } = parsedValue;
        const newOffset = offset + 10;
        await crowi.slackBotService.showEphemeralSearchResults(client, body, args, newOffset);
        break;
      }
      case 'togetterShowMore': {
        const parsedValue = JSON.parse(payload.actions[0].value);
        const togetterHandler = require('../../service/slack-command-handler/togetter')(crowi);

        const { body, args, limit } = parsedValue;
        const newLimit = limit + 1;
        await togetterHandler.handleCommand(client, body, args, newLimit);
        break;
      }
      case 'togetterCreatePage': {
        console.log('Create page and delete the original message here');
        break;
      }
      case 'togetterCancelPageCreation': {
        console.log('Cancel here');
        break;
      }
      default:
        break;
    }
  };

  const handleViewSubmission = async(client, payload) => {
    const { callback_id: callbackId } = payload.view;

    switch (callbackId) {
      case 'createPage':
        await crowi.slackBotService.createPageInGrowi(client, payload);
        break;
      default:
        break;
    }
  };

  async function handleInteractions(req, res) {

    // Send response immediately to avoid opelation_timeout error
    // See https://api.slack.com/apis/connections/events-api#the-events-api__responding-to-events
    res.send();


    const tokenPtoG = req.headers['x-growi-ptog-tokens'];
    // generate client
    let client;
    if (tokenPtoG == null) {
      client = generateClientForResponse();
    }
    else {
      const slackAppIntegration = await SlackAppIntegration.findOne({ tokenPtoG });
      client = generateClientForResponse(slackAppIntegration.tokenGtoP);
    }

    const payload = JSON.parse(req.body.payload);
    const { type } = payload;

    try {
      switch (type) {
        case 'block_actions':
          await handleBlockActions(client, payload);
          break;
        case 'view_submission':
          await handleViewSubmission(client, payload);
          break;
        default:
          break;
      }
    }
    catch (error) {
      logger.error(error);
    }

  }

  router.post('/interactions', addSigningSecretToReq, verifySlackRequest, async(req, res) => {
    return handleInteractions(req, res);
  });

  router.post('/proxied/interactions', verifyAccessTokenFromProxy, async(req, res) => {
    return handleInteractions(req, res);
  });

  return router;
};
