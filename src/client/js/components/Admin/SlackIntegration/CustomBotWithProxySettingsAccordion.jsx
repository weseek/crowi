import React from 'react';
import { useTranslation } from 'react-i18next';
import Accordion from '../Common/Accordion';

const CustomBotWithProxySettingsAccordion = () => {
  const { t } = useTranslation();
  
  // TODO: Handle Test button
  const submitForm = (e) => {
    e.preventDefault();
    console.log('Form Submitted');
  };

  return (
    <div className="card border-0 rounded-lg shadow overflow-hidden">
      <Accordion
        title={<><span className="mr-2">①</span>{t('admin:slack_integration.accordion.create_bot')}</>}
      >
        <div className="my-5 d-flex flex-column align-items-center">
          <button type="button" className="btn btn-primary text-nowrap" onClick={() => window.open('https://api.slack.com/apps', '_blank')}>
            {t('admin:slack_integration.accordion.create_bot')}
            <i className="fa fa-external-link ml-2" aria-hidden="true" />
          </button>
          {/* TODO: Insert DOCS link */}
          <a href="#">
            <p className="text-center mt-1">
              <small>
                {t('admin:slack_integration.accordion.how_to_create_a_bot')}
                <i className="fa fa-external-link ml-2" aria-hidden="true" />
              </small>
            </p>
          </a>
        </div>
      </Accordion>
      <Accordion
        title={<><span className="mr-2">②</span>{t('admin:slack_integration.accordion.install_bot_to_slack')}</>}
      >
        <div className="my-5 d-flex flex-column align-items-center">
          {/* TODO: Insert install link */}
          <button type="button" className="btn btn-primary text-nowrap" onClick={() => window.open('https://api.slack.com/apps', '_blank')}>
            {t('admin:slack_integration.accordion.install_now')}
            <i className="fa fa-external-link ml-2" aria-hidden="true" />
          </button>
          {/* TODO: Insert DOCS link */}
          <a href="#">
            <p className="text-center mt-1">
              <small>
                {t('admin:slack_integration.accordion.how_to_install')}
                <i className="fa fa-external-link ml-2" aria-hidden="true" />
              </small>
            </p>
          </a>
        </div>
      </Accordion>
      <Accordion
        title={<><span className="mr-2">③</span>アクセストークンの発行 / GROWI Official Bot Proxy サービスへの登録</>}
      >

      </Accordion>
      <Accordion
        title={<><span className="mr-2">④</span>ProxyのURLをGROWIに登録する</>}
      >
        4
      </Accordion>
      <Accordion
        title={<><span className="mr-2">⑤</span>連携状況のテストをする</>}
      >
         <p className="text-center m-4">{t('admin:slack_integration.accordion.test_connection_by_pressing_button')}</p>
        <div className="d-flex justify-content-center">
          <form className="form-row align-items-center w-25" onSubmit={e => submitForm(e)}>
            <div className="col-8 input-group-prepend">
              <span className="input-group-text" id="slack-channel-addon"><i className="fa fa-hashtag" /></span>
              <input
                className="form-control w-100"
                type="text"
                value={testChannel}
                placeholder="Slack Channel"
                onChange={e => inputTestChannelHandler(e.target.value)}
              />
            </div>
            <div className="col-4">
              <button
                type="submit"
                className="btn btn-info mx-3 font-weight-bold"
                disabled={testChannel.trim() === ''}
              >Test
              </button>
            </div>
          </form>
        </div>
        {connectionErrorMessage != null
          && <p className="text-danger text-center my-4">{t('admin:slack_integration.accordion.error_check_logs_below')}</p>}
        {connectionSuccessMessage != null
          && <p className="text-info text-center my-4">{t('admin:slack_integration.accordion.send_message_to_slack_work_space')}</p>}
        <form>
          <div className="row my-3 justify-content-center">
            <div className="form-group slack-connection-log w-25">
              <label className="mb-1"><p className="border-info slack-connection-log-title pl-2">Logs</p></label>
              <textarea
                className="form-control card border-info slack-connection-log-body rounded-lg"
                value={value}
                readOnly
              />
            </div>
          </div>
        </form>
      </Accordion>
    </div>
      </Accordion>
    </div>
  );
};

export default CustomBotWithProxySettingsAccordion;
