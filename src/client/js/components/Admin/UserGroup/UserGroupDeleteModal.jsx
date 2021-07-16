import React from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import {
  Modal, ModalHeader, ModalBody, ModalFooter,
} from 'reactstrap';

/**
 * Delete User Group Select component
 *
 * @export
 * @class GrantSelector
 * @extends {React.Component}
 */
class UserGroupDeleteModal extends React.Component {

  constructor(props) {
    super(props);

    const { t } = this.props;

    // actionName master constants
    this.actionForPages = {
      public: 'public',
      delete: 'delete',
      transfer: 'transfer',
    };

    this.availableOptions = [
      {
        id: 1,
        actionForPages: this.actionForPages.public,
        iconClass: 'icon-people',
        styleClass: '',
        label: t('admin:user_group_management.delete_modal.publish_pages'),
      },
      {
        id: 2,
        actionForPages: this.actionForPages.delete,
        iconClass: 'icon-trash',
        styleClass: 'text-danger',
        label: t('admin:user_group_management.delete_modal.delete_pages'),
      },
      {
        id: 3,
        actionForPages: this.actionForPages.transfer,
        iconClass: 'icon-options',
        styleClass: '',
        label: t('admin:user_group_management.delete_modal.transfer_pages'),
      },
    ];

    this.initialState = {
      actionName: '',
      transferToUserGroupId: '',
    };

    this.state = this.initialState;

    if (typeof window !== "undefined") {
      this.xss = window.xss;
    }

    this.onHide = this.onHide.bind(this);
    this.handleActionChange = this.handleActionChange.bind(this);
    this.handleGroupChange = this.handleGroupChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.renderPageActionSelector = this.renderPageActionSelector.bind(this);
    this.renderGroupSelector = this.renderGroupSelector.bind(this);
    this.validateForm = this.validateForm.bind(this);
  }

  onHide() {
    this.setState(this.initialState);
    this.props.onHide();
  }

  handleActionChange(e) {
    const actionName = e.target.value;
    this.setState({ actionName });
  }

  handleGroupChange(e) {
    const transferToUserGroupId = e.target.value;
    this.setState({ transferToUserGroupId });
  }

  handleSubmit(e) {
    e.preventDefault();

    this.props.onDelete({
      deleteGroupId: this.props.deleteUserGroup._id,
      actionName: this.state.actionName,
      transferToUserGroupId: this.state.transferToUserGroupId,
    });
  }

  renderPageActionSelector() {
    const { t } = this.props;

    const optoins = this.availableOptions.map((opt) => {
      const dataContent = `<i class="icon icon-fw ${opt.iconClass} ${opt.styleClass}"></i> <span class="action-name ${opt.styleClass}">${opt.label}</span>`;
      return <option key={opt.id} value={opt.actionForPages} data-content={dataContent}>{opt.label}</option>;
    });

    return (
      <select
        name="actionName"
        className="form-control"
        placeholder="select"
        value={this.state.actionName}
        onChange={this.handleActionChange}
      >
        <option value="" disabled>{t('admin:user_group_management.delete_modal.dropdown_desc')}</option>
        {optoins}
      </select>
    );
  }

  renderGroupSelector() {
    const { t } = this.props;

    const groups = this.props.userGroups.filter((group) => {
      return group._id !== this.props.deleteUserGroup._id;
    });

    const options = groups.map((group) => {
      const dataContent = `<i class="icon icon-fw icon-organization"></i> ${this.xss.process(group.name)}`;
      return <option key={group._id} value={group._id} data-content={dataContent}>{this.xss.process(group.name)}</option>;
    });

    const defaultOptionText = groups.length === 0 ? t('admin:user_group_management.delete_modal.no_groups')
      : t('admin:user_group_management.delete_modal.select_group');

    return (
      <select
        name="transferToUserGroupId"
        className={`form-control ${this.state.actionName === this.actionForPages.transfer ? '' : 'd-none'}`}
        value={this.state.transferToUserGroupId}
        onChange={this.handleGroupChange}
      >
        <option value="" disabled>{defaultOptionText}</option>
        {options}
      </select>
    );
  }

  validateForm() {
    let isValid = true;

    if (this.state.actionName === '') {
      isValid = false;
    }
    else if (this.state.actionName === this.actionForPages.transfer) {
      isValid = this.state.transferToUserGroupId !== '';
    }

    return isValid;
  }

  render() {
    const { t } = this.props;

    return (
      <Modal className="modal-md" isOpen={this.props.isShow} toggle={this.props.onHide}>
        <ModalHeader tag="h4" toggle={this.props.onHide} className="bg-danger text-light">
          <i className="icon icon-fire"></i> {t('admin:user_group_management.delete_modal.header')}
        </ModalHeader>
        <ModalBody>
          <div>
            <span className="font-weight-bold">{t('admin:user_group_management.group_name')}</span> : &quot;{this.props.deleteUserGroup.name}&quot;
          </div>
          <div className="text-danger mt-5">
            {t('admin:user_group_management.delete_modal.desc')}
          </div>
        </ModalBody>
        <ModalFooter>
          <form className="d-flex justify-content-between w-100" onSubmit={this.handleSubmit}>
            <div className="d-flex form-group mb-0">
              {this.renderPageActionSelector()}
              {this.renderGroupSelector()}
            </div>
            <button type="submit" value="" className="btn btn-sm btn-danger text-nowrap" disabled={!this.validateForm()}>
              <i className="icon icon-fire"></i> {t('Delete')}
            </button>
          </form>
        </ModalFooter>
      </Modal>
    );
  }

}

UserGroupDeleteModal.propTypes = {
  t: PropTypes.func.isRequired, // i18next

  userGroups: PropTypes.arrayOf(PropTypes.object).isRequired,
  deleteUserGroup: PropTypes.object,
  onDelete: PropTypes.func.isRequired,
  isShow: PropTypes.bool.isRequired,
  onShow: PropTypes.func.isRequired,
  onHide: PropTypes.func.isRequired,
};

UserGroupDeleteModal.defaultProps = {
  deleteUserGroup: {},
};

export default withTranslation()(UserGroupDeleteModal);
