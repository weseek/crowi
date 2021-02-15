import React, { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import {
  Modal, ModalBody, ModalHeader, TabContent, TabPane,
} from 'reactstrap';

import { withTranslation } from 'react-i18next';
import PageListIcon from '../../client/js/components/Icons/PageListIcon';
import TimeLineIcon from '../../client/js/components/Icons/TimeLineIcon';
import HistoryIcon from '../../client/js/components/Icons/HistoryIcon';
import AttachmentIcon from '../../client/js/components/Icons/AttachmentIcon';
import ShareLinkIcon from '../../client/js/components/Icons/ShareLinkIcon';

import { withUnstatedContainers } from '../../client/js/components/UnstatedUtils';
import PageAccessoriesContainer from '../../client/js/services/PageAccessoriesContainer';
import PageAttachment from '../../client/js/components/PageAttachment';
import PageTimeline from '../../client/js/components/PageTimeline';
import PageList from '../../client/js/components/PageList';
import PageHistory from './PageHistory';
import ShareLink from '../../client/js/components/ShareLink/ShareLink';
import { CustomNavTab } from '../../client/js/components/CustomNavigation/CustomNav';
import ExpandOrContractButton from '../../client/js/components/ExpandOrContractButton';

const PageAccessoriesModal = (props) => {
  const {
    t, pageAccessoriesContainer, onClose, isGuestUser, isSharedUser,
  } = props;
  const { switchActiveTab } = pageAccessoriesContainer;
  const { activeTab, activeComponents } = pageAccessoriesContainer.state;
  const [isWindowExpanded, setIsWindowExpanded] = useState(false);

  const navTabMapping = useMemo(() => {
    return {
      pagelist: {
        Icon: PageListIcon,
        i18n: t('page_list'),
        index: 0,
        isLinkEnabled: v => !isSharedUser,
      },
      timeline: {
        Icon: TimeLineIcon,
        i18n: t('Timeline View'),
        index: 1,
        isLinkEnabled: v => !isSharedUser,
      },
      pageHistory: {
        Icon: HistoryIcon,
        i18n: t('History'),
        index: 2,
        isLinkEnabled: v => !isGuestUser && !isSharedUser,
      },
      attachment: {
        Icon: AttachmentIcon,
        i18n: t('attachment_data'),
        index: 3,
      },
      shareLink: {
        Icon: ShareLinkIcon,
        i18n: t('share_links.share_link_management'),
        index: 4,
        isLinkEnabled: v => !isGuestUser && !isSharedUser,
      },
    };
  }, [t, isGuestUser, isSharedUser]);

  const closeModalHandler = useCallback(() => {
    if (onClose == null) {
      return;
    }
    onClose();
  }, [onClose]);

  const expandWindow = () => {
    setIsWindowExpanded(true);
  };

  const contractWindow = () => {
    setIsWindowExpanded(false);
  };

  const buttons = (
    <div className="d-flex flex-nowrap">
      <ExpandOrContractButton
        isWindowExpanded={isWindowExpanded}
        expandWindow={expandWindow}
        contractWindow={contractWindow}
      />
      <button type="button" className="close" onClick={closeModalHandler} aria-label="Close">
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );

  return (
    <React.Fragment>
      <Modal
        size="xl"
        isOpen={props.isOpen}
        toggle={closeModalHandler}
        className={`grw-page-accessories-modal ${isWindowExpanded ? 'grw-modal-expanded' : ''} `}
      >
        <ModalHeader className="p-0" toggle={closeModalHandler} close={buttons}>
          <CustomNavTab
            activeTab={activeTab}
            navTabMapping={navTabMapping}
            onNavSelected={switchActiveTab}
            breakpointToHideInactiveTabsDown="md"
            hideBorderBottom
          />
        </ModalHeader>
        <ModalBody className="overflow-auto grw-modal-body-style p-0">
          {/* Do not use CustomTabContent because of performance problem:
              the 'navTabMapping[tabId].Content' for PageAccessoriesModal depends on activeComponents */}
          <TabContent activeTab={activeTab} className="p-5">
            <TabPane tabId="pagelist">
              {activeComponents.has('pagelist') && <PageList />}
            </TabPane>
            <TabPane tabId="timeline">
              {activeComponents.has('timeline') && <PageTimeline /> }
            </TabPane>
            {!isGuestUser && (
              <TabPane tabId="pageHistory">
                {activeComponents.has('pageHistory') && <PageHistory /> }
              </TabPane>
            )}
            <TabPane tabId="attachment">
              {activeComponents.has('attachment') && <PageAttachment />}
            </TabPane>
            {!isGuestUser && (
              <TabPane tabId="shareLink">
                {activeComponents.has('shareLink') && <ShareLink />}
              </TabPane>
            )}
          </TabContent>
        </ModalBody>
      </Modal>
    </React.Fragment>
  );
};

/**
 * Wrapper component for using unstated
 */
const PageAccessoriesModalWrapper = withUnstatedContainers(PageAccessoriesModal, [PageAccessoriesContainer]);

PageAccessoriesModal.propTypes = {
  t: PropTypes.func.isRequired, //  i18next
  pageAccessoriesContainer: PropTypes.instanceOf(PageAccessoriesContainer).isRequired,
  isGuestUser: PropTypes.bool.isRequired,
  isSharedUser: PropTypes.bool.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
};

export default withTranslation()(PageAccessoriesModalWrapper);