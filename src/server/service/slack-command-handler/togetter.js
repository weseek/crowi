const {
  inputBlock, actionsBlock, buttonElement, checkboxesElementOption,
} = require('@growi/slack');
const { fromUnixTime, format } = require('date-fns');

module.exports = () => {
  const BaseSlackCommandHandler = require('./slack-command-handler');
  const handler = new BaseSlackCommandHandler();

  handler.handleCommand = async function(client, body, args, limit = 10) {
    // TODO GW-6721 Get the time from args
    const result = await client.conversations.history({
      channel: body.channel_id,
      limit,
    });
      // Return Checkbox Message
    client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: 'Select messages to use.',
      blocks: this.togetterMessageBlocks(result.messages, body, args, limit),
    });
    return;
  };

  handler.togetterMessageBlocks = function(messages, body, args, limit) {
    return [
      inputBlock(this.togetterCheckboxesElement(messages), 'selected_messages', 'Select massages to use.'),
      actionsBlock(buttonElement({ text: 'Show more', actionId: 'togetterShowMore', value: JSON.stringify({ body, args, limit }) })),
      inputBlock(this.togetterInputBlockElement('page_path', '/'), 'page_path', 'Page path'),
      actionsBlock(
        buttonElement({ text: 'Cancel', actionId: 'togetterCancelPageCreation' }),
        buttonElement({ text: 'Create page', actionId: 'togetterCreatePage', color: 'primary' }),
      ),
    ];
  };

  handler.togetterCheckboxesElement = function(messages) {
    return {
      type: 'checkboxes',
      options: this.togetterCheckboxesElementOptions(messages),
      action_id: 'checkboxes_changed',
    };
  };

  handler.togetterCheckboxesElementOptions = function(messages) {
    const options = messages
      .sort((a, b) => { return a.ts - b.ts })
      .map((message, index) => {
        const date = fromUnixTime(message.ts);
        return checkboxesElementOption(`*${message.user}*  ${format(new Date(date), 'yyyy/MM/dd HH:mm:ss')}`, message.text, `selected-${index}`);
      });
    return options;
  };

  /**
   * Plain-text input element
   * https://api.slack.com/reference/block-kit/block-elements#input
   */
  handler.togetterInputBlockElement = function(actionId, placeholderText = 'Write something ...') {
    return {
      type: 'plain_text_input',
      placeholder: {
        type: 'plain_text',
        text: placeholderText,
      },
      action_id: actionId,
    };
  };

  return handler;
};
