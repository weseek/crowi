import React from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';

import { toastSuccess, toastError } from '../../../util/apiNotification';
import { apiv3Get, apiv3Post } from '~/utils/apiv3-client';

class UserGroupCreateForm extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      name: '',
    };

    if (typeof window !== "undefined") {
      this.xss = window.xss;
    }

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.validateForm = this.validateForm.bind(this);
  }

  handleChange(event) {
    const target = event.target;
    const value = target.type === 'checkbox' ? target.checked : target.value;
    const name = target.name;

    this.setState({
      [name]: value,
    });
  }

  async handleSubmit(e) {
    e.preventDefault();

    try {
      const res = await apiv3Post('/user-groups', {
        name: this.state.name,
      });

      const userGroup = res.data.userGroup;
      const userGroupId = userGroup._id;

      const res2 = await apiv3Get(`/user-groups/${userGroupId}/users`);

      const { users } = res2.data;

      this.props.onCreate(userGroup, users);

      this.setState({ name: '' });

      toastSuccess(`Created a user group "${this.xss.process(userGroup.name)}"`);
    }
    catch (err) {
      toastError(err);
    }
  }

  validateForm() {
    return this.state.name !== '';
  }

  render() {
    const { t } = this.props;

    return (
      <div>
        <p>
          {this.props.isAclEnabled
            ? (
              <button type="button" data-toggle="collapse" className="btn btn-outline-secondary" href="#createGroupForm">
                {t('admin:user_group_management.create_group')}
              </button>
            )
            : (
              t('admin:user_group_management.deny_create_group')
            )
          }
        </p>
        <form onSubmit={this.handleSubmit}>
          <div id="createGroupForm" className="collapse">
            <div className="form-group">
              <label htmlFor="name">{t('admin:user_group_management.group_name')}</label>
              <textarea
                id="name"
                name="name"
                className="form-control"
                placeholder={t('admin:user_group_management.group_example')}
                value={this.state.name}
                onChange={this.handleChange}
              >
              </textarea>
            </div>
            <button type="submit" className="btn btn-primary" disabled={!this.validateForm()}>{t('Create')}</button>
          </div>
        </form>
      </div>
    );
  }

}

UserGroupCreateForm.propTypes = {
  t: PropTypes.func.isRequired, // i18next

  isAclEnabled: PropTypes.bool.isRequired,
  onCreate: PropTypes.func.isRequired,
};

export default withTranslation()(UserGroupCreateForm);
