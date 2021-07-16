import useSWR, { responseInterface } from 'swr';
import { apiv3Get } from '~/client/js/util/apiv3-client';
import {
  UserGroup as IUserGroup,
  UserGroupRelation as IUserGroupRelation
} from '~/interfaces/user';
import {
  appParams as IAppParams,
  markdownParams as IMarkdownParams,
  customizeParams as ICustomizeParams,
  securityParamsGeneralSetting as ISecurityParamsGeneralSetting,
} from '~/interfaces/admin';


export const useAppSettingsSWR = (): responseInterface<IAppParams, Error> => {
  return useSWR(
    '/app-settings',
    (endpoint, path) => apiv3Get(endpoint, { path }).then(result => result.data.appSettingsParams),
    { revalidateOnFocus: false },
  );
};

export const useMarkdownSettingsSWR = (): responseInterface<IMarkdownParams, Error> => {
  return useSWR(
    '/markdown-setting',
    (endpoint, path) => apiv3Get(endpoint, { path }).then(result => result.data.markdownParams),
    { revalidateOnFocus: false },
  );
};

export const useCustomizeSettingsSWR = (): responseInterface<ICustomizeParams, Error> => {
  return useSWR(
    '/customize-setting',
    (endpoint, path) => apiv3Get(endpoint, { path }).then(result => result.data.customizeParams),
    { revalidateOnFocus: false },
  );
};

export const useSecuritySettingGeneralSWR = (): responseInterface<ISecurityParamsGeneralSetting, Error> => {
  return useSWR(
    '/security-setting',
    (endpoint, path) => apiv3Get(endpoint, { path }).then(result => result.data.securityParams.generalSetting),
    { revalidateOnFocus: false },
  );
};

// TODO: fix pagination
// export const useUserGroupSWR = ({ pagination }): responseInterface<IUserGroup[], Error> => {
//   return useSWR(
//     ['/user-groups', pagination],
//     (endpoint, pagination) => apiv3Get(endpoint, { pagination })
//       .then(result => result.data),
//     { revalidateOnFocus: false },
//   );
// };

export const useUserGroupRelationsSWR = (): responseInterface<IUserGroupRelation[], Error> => {
  return useSWR(
    '/user-group-relations',
    (endpoint) => apiv3Get(endpoint).then(result => result.data.userGroupRelations),
    { revalidateOnFocus: false },
  );
};
