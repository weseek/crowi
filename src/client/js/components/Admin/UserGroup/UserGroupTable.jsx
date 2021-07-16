import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import dateFnsFormat from 'date-fns/format';

class UserGroupTable extends React.Component {

  constructor(props) {
    super(props);

    if (typeof window !== "undefined") {
      this.xss = window.xss;
    }

    this.state = {
      userGroups: this.props.userGroups,
      userGroupMap: {},
    };

    this.generateUserGroupMap = this.generateUserGroupMap.bind(this);
    this.onDelete = this.onDelete.bind(this);
  }

  componentWillMount() {
    const userGroupMap = this.generateUserGroupMap(this.props.userGroups, this.props.userGroupRelations);
    this.setState({ userGroupMap });
  }

  componentWillReceiveProps(nextProps) {
    const { userGroups, userGroupRelations } = nextProps;
    const userGroupMap = this.generateUserGroupMap(userGroups, userGroupRelations);

    this.setState({
      userGroups,
      userGroupMap,
    });
  }

  generateUserGroupMap(userGroups, userGroupRelations) {
    const userGroupMap = {};
    userGroupRelations.forEach((relation) => {
      const group = relation.relatedGroup;

      const users = userGroupMap[group] || [];
      users.push(relation.relatedUser);

      // register
      userGroupMap[group] = users;
    });

    return userGroupMap;
  }

  onDelete(e) {
    const { target } = e;
    const groupId = target.getAttribute('data-user-group-id');
    const group = this.state.userGroups.find((group) => {
      return group._id === groupId;
    });

    this.props.onDelete(group);
  }

  render() {
    const { t } = this.props;

    return (
      <Fragment>
        <h2>{t('admin:user_group_management.group_list')}</h2>

        <table className="table table-bordered table-user-list">
          <thead>
            <tr>
              <th>{t('Name')}</th>
              <th>{t('User')}</th>
              <th width="100px">{t('Created')}</th>
              <th width="70px"></th>
            </tr>
          </thead>
          <tbody>
            {this.state.userGroups.map((group) => {
              const users = this.state.userGroupMap[group._id];

              return (
                <tr key={group._id}>
                  {this.props.isAclEnabled
                    ? (
                      <td><a href={`/admin/user-group-detail/${group._id}`}>{this.xss.process(group.name)}</a></td>
                    )
                    : (
                      <td>{this.xss.process(group.name)}</td>
                    )
                  }
                  <td>
                    <ul className="list-inline">
                      {users != null && users.map((user) => {
                        return <li key={user._id} className="list-inline-item badge badge-pill badge-warning">{this.xss.process(user.username)}</li>;
                      })}
                    </ul>
                  </td>
                  <td>{dateFnsFormat(new Date(group.createdAt), 'yyyy-MM-dd')}</td>
                  {this.props.isAclEnabled
                    ? (
                      <td>
                        <div className="btn-group admin-group-menu">
                          <button
                            type="button"
                            id={`admin-group-menu-button-${group._id}`}
                            className="btn btn-outline-secondary btn-sm dropdown-toggle"
                            data-toggle="dropdown"
                          >
                            <i className="icon-settings"></i>
                          </button>
                          <div className="dropdown-menu" role="menu" aria-labelledby={`admin-group-menu-button-${group._id}`}>
                            <a className="dropdown-item" href={`/admin/user-group-detail/${group._id}`}>
                              <i className="icon-fw icon-note"></i> {t('Edit')}
                            </a>
                            <button className="dropdown-item" type="button" role="button" onClick={this.onDelete} data-user-group-id={group._id}>
                              <i className="icon-fw icon-fire text-danger"></i> {t('Delete')}
                            </button>
                          </div>
                        </div>
                      </td>
                    )
                    : (
                      <td></td>
                    )
                  }
                </tr>
              );
            })}
          </tbody>
        </table>
      </Fragment>
    );
  }

}

UserGroupTable.propTypes = {
  t: PropTypes.func.isRequired, // i18next

  userGroups: PropTypes.arrayOf(PropTypes.object).isRequired,
  userGroupRelations: PropTypes.arrayOf(PropTypes.object).isRequired,
  isAclEnabled: PropTypes.bool.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default withTranslation()(UserGroupTable);
