
const logger = require('@alias/logger')('growi:service:SlackBotService');
const mongoose = require('mongoose');
const axios = require('axios');

const { markdownSectionBlock } = require('@growi/slack');
const { reshapeContentsBody } = require('@growi/slack');
const { formatDistanceStrict } = require('date-fns');

const S2sMessage = require('../models/vo/s2s-message');
const S2sMessageHandlable = require('./s2s-messaging/handlable');

class SlackBotService extends S2sMessageHandlable {

  constructor(crowi) {
    super();

    this.crowi = crowi;
    this.s2sMessagingService = crowi.s2sMessagingService;

    this.lastLoadedAt = null;

    this.initialize();
  }

  initialize() {
    this.lastLoadedAt = new Date();
  }

  /**
   * @inheritdoc
   */
  shouldHandleS2sMessage(s2sMessage) {
    const { eventName, updatedAt } = s2sMessage;
    if (eventName !== 'slackBotServiceUpdated' || updatedAt == null) {
      return false;
    }

    return this.lastLoadedAt == null || this.lastLoadedAt < new Date(s2sMessage.updatedAt);
  }


  /**
   * @inheritdoc
   */
  async handleS2sMessage() {
    const { configManager } = this.crowi;

    logger.info('Reset slack bot by pubsub notification');
    await configManager.loadConfigs();
    this.initialize();
  }

  async publishUpdatedMessage() {
    const { s2sMessagingService } = this;

    if (s2sMessagingService != null) {
      const s2sMessage = new S2sMessage('slackBotServiceUpdated', { updatedAt: new Date() });

      try {
        await s2sMessagingService.publish(s2sMessage);
      }
      catch (e) {
        logger.error('Failed to publish update message with S2sMessagingService: ', e.message);
      }
    }
  }

  /**
   * Handle /commands endpoint
   */
  async handleCommand(command, client, body, ...opt) {
    const module = `./slack-command-handler/${command}`;
    try {
      const handler = require(module)(this.crowi);
      await handler.handleCommand(client, body, ...opt);
    }
    catch (err) {
      this.notCommand(client, body);
    }
  }

  async notCommand(client, body) {
    logger.error('Invalid first argument');
    client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: 'No command',
      blocks: [
        markdownSectionBlock('*No command.*\n Hint\n `/growi [command] [keyword]`'),
      ],
    });
    return;
  }

  generatePageLinkMrkdwn(pathname, href) {
    return `<${decodeURI(href)} | ${decodeURI(pathname)}>`;
  }

  appendSpeechBaloon(mrkdwn, commentCount) {
    return (commentCount != null && commentCount > 0)
      ? `${mrkdwn}   :speech_balloon: ${commentCount}`
      : mrkdwn;
  }

  generateLastUpdateMrkdwn(updatedAt, baseDate) {
    if (updatedAt != null) {
      // cast to date
      const date = new Date(updatedAt);
      return formatDistanceStrict(date, baseDate);
    }
    return '';
  }


  async shareSinglePage(client, payload) {
    const { channel, user, actions } = payload;

    const appUrl = this.crowi.appService.getSiteUrl();
    const appTitle = this.crowi.appService.getAppTitle();

    const channelId = channel.id;
    const action = actions[0]; // shareSinglePage action must have button action

    // restore page data from value
    const { page, href, pathname } = JSON.parse(action.value);
    const { updatedAt, commentCount } = page;

    // share
    const now = new Date();
    return client.chat.postMessage({
      channel: channelId,
      blocks: [
        { type: 'divider' },
        markdownSectionBlock(`${this.appendSpeechBaloon(`*${this.generatePageLinkMrkdwn(pathname, href)}*`, commentCount)}`),
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `<${decodeURI(appUrl)}|*${appTitle}*>  |  Last updated: ${this.generateLastUpdateMrkdwn(updatedAt, now)}  |  Shared by *${user.username}*`,
            },
          ],
        },
      ],
    });
  }

  async dismissSearchResults(client, payload) {
    const { response_url: responseUrl } = payload;

    return axios.post(responseUrl, {
      delete_original: true,
    });
  }

  // Submit action in create Modal
  async createPage(client, payload, contentsBody) {
    const Page = this.crowi.model('Page');
    const pathUtils = require('growi-commons').pathUtils;
    const reshapedContentsBody = reshapeContentsBody(contentsBody);
    let path = '';
    let channelId = '';
    try {
      if (payload.type === 'block_actions' && payload.actions[0].action_id === 'togetterCreatePage') {
        path = payload.state.values.page_path.page_path.value;
        channelId = payload.channel.id;
      }
      else {
        path = payload.view.state.values.path.path_input.value;
        channelId = JSON.parse(payload.view.private_metadata).channelId;
      }
      // sanitize path
      path = this.crowi.xss.process(path);
      path = pathUtils.normalizePath(path);

      // generate a dummy id because Operation to create a page needs ObjectId
      const dummyObjectIdOfUser = new mongoose.Types.ObjectId();
      const page = await Page.create(path, reshapedContentsBody, dummyObjectIdOfUser, {});

      // Send a message when page creation is complete
      const growiUri = this.crowi.appService.getSiteUrl();
      await client.chat.postEphemeral({
        channel: channelId,
        user: payload.user.id,
        text: `The page <${decodeURI(`${growiUri}/${page._id} | ${decodeURI(growiUri + path)}`)}> has been created.`,
      });
    }
    catch (err) {
      client.chat.postMessage({
        channel: payload.user.id,
        blocks: [
          markdownSectionBlock(`Cannot create new page to existed path\n *Contents* :memo:\n ${reshapedContentsBody}`)],
      });
      logger.error('Failed to create page in GROWI.');
      throw err;
    }
  }

  async createPageInGrowi(client, payload) {
    const contentsBody = payload.view.state.values.contents.contents_input.value;
    await this.createPage(client, payload, contentsBody);
  }

  async togetterCreatePageInGrowi(client, payload) {
    const { response_url: responseUrl } = payload;
    const selectedOptions = payload.state.values.selected_messages.checkboxes_changed.selected_options;
    const messages = selectedOptions.map((option) => {
      const header = option.text.text.concat('\n');
      const body = option.description.text.concat('\n');
      return header.concat(body);
    });
    const contentsBody = messages.join('');
    // dismiss
    axios.post(responseUrl, {
      delete_original: true,
    });
    await this.createPage(client, payload, contentsBody);
  }

}

module.exports = SlackBotService;
