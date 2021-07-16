import React, { useState } from 'react'
import { useUserGroupSWR, useUserGroupRelationsSWR } from '~/stores/admin';
import { useAclEnabled } from '~/stores/context';

import UserGroupTable from '~/client/js/components/Admin/UserGroup/UserGroupTable';
import UserGroupCreateForm from '~/client/js/components/Admin/UserGroup/UserGroupCreateForm';
import UserGroupDeleteModal from '~/client/js/components/Admin/UserGroup/UserGroupDeleteModal';

import { toastSuccess, toastError } from '~/client/js/util/apiNotification';
import { apiv3Delete } from '~/utils/apiv3-client';

export const UserGroupPage = (): JSX.Element => {
  const isAclEnabled = useAclEnabled();
  const [selectedUserGroup, setSelectedUserGroup] = useState(undefined); // not null but undefined (to use defaultProps in UserGroupDeleteModal)
  const [isDeleteModalShow, setIsDeleteModalShow] = useState(false);
  // TODO: Fix pagination src/server/models/user-group.ts
  const userGroupsData = [];
  // const { data: userGroupsData, mutate: mutateGroups } = useUserGroupSWR({ pagination: false });
  const { data: userGroupRelationsData, mutate: mutateRelations } = useUserGroupRelationsSWR();

  const showDeleteModal = async (group) => {
    try {
      await mutateRelations();
      setSelectedUserGroup(group);
      setIsDeleteModalShow(true)
    }
    catch (err) {
      toastError(err);
    }
  }

  const hideDeleteModal = () => {
    setSelectedUserGroup(undefined);
    setIsDeleteModalShow(false);
  }

  const mutateGroupsAndRelations = () => {
    // mutateGroups();
    mutateRelations();
  }

  const deleteUserGroupById = async ({ deleteGroupId, actionName, transferToUserGroupId }) => {
    try {
      const res = await apiv3Delete(`/user-groups/${deleteGroupId}`, {
        actionName,
        transferToUserGroupId,
      });
      mutateGroupsAndRelations();
      setSelectedUserGroup(undefined);
      setIsDeleteModalShow(false);
      toastSuccess(`Deleted group "${res.data.userGroup.name}"`);
    }
    catch (err) {
      toastError(new Error('Unable to delete the group'));
    }
  }

  return (
    <>
      <UserGroupCreateForm
        isAclEnabled={isAclEnabled}
        onCreate={mutateGroupsAndRelations}
      />
      {userGroupsData != null && userGroupRelationsData != null
        && (
          <>
            <UserGroupTable
              userGroups={userGroupsData}
              isAclEnabled={isAclEnabled}
              onDelete={showDeleteModal}
              userGroupRelations={userGroupRelationsData}
            />
            <UserGroupDeleteModal
              userGroups={userGroupsData}
              deleteUserGroup={selectedUserGroup}
              onDelete={deleteUserGroupById}
              isShow={isDeleteModalShow}
              onShow={showDeleteModal}
              onHide={hideDeleteModal}
            />
          </>
        )
      }
    </>
  )
}

export default UserGroupPage;
