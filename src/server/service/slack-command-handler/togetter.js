const { getUnixTime, parse } = require('date-fns');
const {
  inputBlock, actionsBlock, buttonElement, checkboxesElementOption,
} = require('@growi/slack');

module.exports = () => {
  const BaseSlackCommandHandler = require('./slack-command-handler');
  const handler = new BaseSlackCommandHandler();

  handler.handleCommand = async function(client, body, args, limit = 10) {
    let latest;
    if (args[1] != null) {
      latest = getUnixTime(parse(args[1], 'HH:mm', new Date()));
    }
    const reusult = await client.conversations.history({
      channel: body.channel_id,
      limit,
      latest,
    });
    console.log(reusult);
    console.log(20, parse(args[1], 'HH:mm', new Date()), getUnixTime(parse(args[1], 'HH:mm', new Date())));

    // Return Checkbox Message
    client.chat.postEphemeral({
      channel: body.channel_id,
      user: body.user_id,
      text: 'Select messages to use.',
      blocks: this.togetterMessageBlocks(),
    });
    return;
  };

  handler.togetterMessageBlocks = function() {
    return [
      inputBlock(this.togetterCheckboxesElement(), 'selected_messages', 'Select massages to use.'),
      actionsBlock(buttonElement('Show more', 'togetterShowMore')),
      inputBlock(this.togetterInputBlockElement('page_path', '/'), 'page_path', 'Page path'),
      actionsBlock(buttonElement('Cancel', 'togetterCancelPageCreation'), buttonElement('Create page', 'togetterCreatePage', 'primary')),
    ];
  };

  handler.togetterCheckboxesElement = function() {
    return {
      type: 'checkboxes',
      options: this.togetterCheckboxesElementOptions(),
      action_id: 'checkboxes_changed',
    };
  };

  handler.togetterCheckboxesElementOptions = function() {
    // increment options with results from conversations.history
    const options = [];
    // temporary code
    for (let i = 0; i < 10; i++) {
      const option = checkboxesElementOption('*username*  12:00PM', 'sample slack messages ... :star:', `selected-${i}`);
      options.push(option);
    }
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
