export type appParams = {
  title: string,
  confidential: string,
  globalLang: string,
  fileUpload: string,
  siteUrl: string,
  envSiteUrl: string
  isMailerSetup: boolean,
  fromAddress: string,

  transmissionMethod: string,
  smtpHost: string,
  smtpPort: number,
  smtpUser: string,
  smtpPassword: string,
  sesAccessKeyId: string,
  sesSecretAccessKey: string,

  fileUploadType: string,
  envFileUploadType: string,
  useOnlyEnvVarForFileUploadType: string,

  s3Region: string,
  s3CustomEndpoint: string,
  s3Bucket: string,
  s3AccessKeyId: string,
  s3SecretAccessKey: string,
  s3ReferenceFileWithRelayMode: string,

  gcsUseOnlyEnvVars: string,
  gcsApiKeyJsonPath: string,
  gcsBucket: string,
  gcsUploadNamespace: string,
  gcsReferenceFileWithRelayMode: string,

  envGcsApiKeyJsonPath: string,
  envGcsBucket: string,
  envGcsUploadNamespace: string,

  isEnabledPlugins: boolean,
}

export type markdownParams = {
  isEnabledLinebreaks: boolean,
  isEnabledLinebreaksInComments: boolean,
  pageBreakSeparator: number,
  pageBreakCustomSeparator: string,
  isEnabledXss: boolean,
  xssOption: number,
  tagWhiteList: string[],
  attrWhiteList: string[],
}

export type customizeParams = {
  customizeCss?: string,
  customizeHeader?: string,
  customizeScript?: string,
  customizeTitle?: string,
  isAllReplyShown: boolean,
  isEnabledAttachTitleHeader: boolean,
  isEnabledStaleNotification: boolean,
  isSavedStatesOfTabChanges: boolean,
  layoutType?: string,
  pageLimitationL: number,
  pageLimitationM: number,
  pageLimitationS: number,
  pageLimitationXL: number,
  styleBorder: boolean,
  styleName: string,
  themeType: string,
}

export type securityParamsGeneralSetting = {
  restrictGuestMode: string,
  pageCompleteDeletionAuthority: string,
  hideRestrictedByOwner: string,
  hideRestrictedByGroup: string,
  wikiMode: string,
}
