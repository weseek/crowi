import nodePath from 'path';
import urljoin from 'url-join';
import mongoose, {
  Types, Model, Schema, model,
} from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import uniqueValidator from 'mongoose-unique-validator';
import differenceInYears from 'date-fns/differenceInYears';

import { pathUtils } from 'growi-commons';
import escapeStringRegexp from 'escape-string-regexp';
import { isTopPage, isTrashPage } from '~/utils/path-utils';
import templateChecker from '~/utils/template-checker';
import loggerFactory from '~/utils/logger';
import { getOrCreateModel } from '~/server/util/mongoose-utils';
import { USER_PUBLIC_FIELDS, IUser } from '~/server/models/new-user';
import ConfigManager from '~/server/service/config-manager';


const logger = loggerFactory('growi:models:page');
export interface IPage {
  _id: string;
  path: string;
  status: string;
  // revision: Revision,
  creator: IUser;
  createdAt: Date;
  updatedAt: Date;
  relatedTag: any;
}

type PageOptions = {
  format?:string,
  redirectTo?:string,
  grantUserGroupId?:string,
  socketClientId?:string,
  grant?:number,
  isSyncRevisionToHackmd?:boolean
}

/*
 * define schema
 */
export const GRANT_PUBLIC = 1;
export const GRANT_RESTRICTED = 2;
export const GRANT_SPECIFIED = 3;
export const GRANT_OWNER = 4;
export const GRANT_USER_GROUP = 5;
export const PAGE_GRANT_ERROR = 1;
export const STATUS_PUBLISHED = 'published';
export const STATUS_DELETED = 'deleted';

const pageSchema = new Schema<IPage>({
  path: {
    type: String, required: true, index: true, unique: true,
  },
  revision: { type: Types.ObjectId, ref: 'Revision' },
  redirectTo: { type: String, index: true },
  status: { type: String, default: STATUS_PUBLISHED, index: true },
  grant: { type: Number, default: GRANT_PUBLIC, index: true },
  grantedUsers: [{ type: Types.ObjectId, ref: 'User' }],
  grantedGroup: { type: Types.ObjectId, ref: 'UserGroup', index: true },
  creator: { type: Types.ObjectId, ref: 'User', index: true },
  lastUpdateUser: { type: Types.ObjectId, ref: 'User' },
  liker: [{ type: Types.ObjectId, ref: 'User' }],
  seenUsers: [{ type: Types.ObjectId, ref: 'User' }],
  commentCount: { type: Number, default: 0 },
  extended: {
    type: String,
    default: '{}',
    get(data) {
      try {
        return JSON.parse(data);
      }
      catch (e) {
        return data;
      }
    },
    set(data) {
      return JSON.stringify(data);
    },
  },
  pageIdOnHackmd: String,
  revisionHackmdSynced: { type: Types.ObjectId, ref: 'Revision' }, // the revision that is synced to HackMD
  hasDraftOnHackmd: { type: Boolean }, // set true if revision and revisionHackmdSynced are same but HackMD document has modified
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deleteUser: { type: Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date },
}, {
  toJSON: { getters: true },
  toObject: { getters: true },
});
// apply plugins
pageSchema.plugin(mongoosePaginate);
pageSchema.plugin(uniqueValidator);


/**
 * return an array of ancestors paths that is extracted from specified pagePath
 * e.g.
 *  when `pagePath` is `/foo/bar/baz`,
 *  this method returns [`/foo/bar/baz`, `/foo/bar`, `/foo`, `/`]
 *
 * @param {string} pagePath
 * @return {string[]} ancestors paths
 */
const extractToAncestorsPaths = (pagePath) => {
  const ancestorsPaths: string[] = [];

  let parentPath;
  while (parentPath !== '/') {
    parentPath = nodePath.dirname(parentPath || pagePath);
    ancestorsPaths.push(parentPath);
  }

  return ancestorsPaths;
};

/**
 * populate page (Query or Document) to show revision
 * @param {any} page Query or Document
 * @param {string} userPublicFields string to set to select
 */
/* eslint-disable object-curly-newline, object-property-newline */
const populateDataToShowRevision = (page, userPublicFields) => {
  return page
    .populate([
      { path: 'lastUpdateUser', model: 'User', select: userPublicFields },
      { path: 'creator', model: 'User', select: userPublicFields },
      { path: 'deleteUser', model: 'User', select: userPublicFields },
      { path: 'grantedGroup', model: 'UserGroup' },
      { path: 'revision', model: 'Revision', populate: {
        path: 'author', model: 'User', select: userPublicFields,
      } },
    ]);
};
/* eslint-enable object-curly-newline, object-property-newline */


class PageQueryBuilder {

  query: any;

  constructor(query) {
    this.query = query;
  }

  addConditionToExcludeTrashed() {
    this.query = this.query
      .and({
        $or: [
          { status: null },
          { status: STATUS_PUBLISHED },
        ],
      });

    return this;
  }

  addConditionToExcludeRedirect() {
    this.query = this.query.and({ redirectTo: null });
    return this;
  }

  /**
   * generate the query to find the pages '{path}/*' and '{path}' self.
   * If top page, return without doing anything.
   */
  addConditionToListWithDescendants(path) {
    // No request is set for the top page
    if (isTopPage(path)) {
      return this;
    }

    const pathNormalized = pathUtils.normalizePath(path);
    const pathWithTrailingSlash = pathUtils.addTrailingSlash(path);

    const startsPattern = escapeStringRegexp(pathWithTrailingSlash);

    this.query = this.query
      .and({
        $or: [
          { path: pathNormalized },
          { path: new RegExp(`^${startsPattern}`) },
        ],
      });

    return this;
  }

  /**
   * generate the query to find the pages '{path}/*' (exclude '{path}' self).
   * If top page, return without doing anything.
   */
  addConditionToListOnlyDescendants(path, option) {
    // No request is set for the top page
    if (isTopPage(path)) {
      return this;
    }

    const pathWithTrailingSlash = pathUtils.addTrailingSlash(path);

    const startsPattern = escapeStringRegexp(pathWithTrailingSlash);

    this.query = this.query
      .and({ path: new RegExp(`^${startsPattern}`) });

    return this;

  }

  /**
   * generate the query to find pages that start with `path`
   *
   * In normal case, returns '{path}/*' and '{path}' self.
   * If top page, return without doing anything.
   *
   * *option*
   *   Left for backward compatibility
   */
  addConditionToListByStartWith(path, option) {
    // No request is set for the top page
    if (isTopPage(path)) {
      return this;
    }

    const startsPattern = escapeStringRegexp(path);

    this.query = this.query
      .and({ path: new RegExp(`^${startsPattern}`) });

    return this;
  }

  addConditionToFilteringByViewer(user, userGroups, showAnyoneKnowsLink = false, showPagesRestrictedByOwner = false, showPagesRestrictedByGroup = false) {
    const grantConditions:{[key:string]:any} = [
      { grant: null },
      { grant: GRANT_PUBLIC },
    ];

    if (showAnyoneKnowsLink) {
      grantConditions.push({ grant: GRANT_RESTRICTED });
    }

    if (showPagesRestrictedByOwner) {
      grantConditions.push(
        { grant: GRANT_SPECIFIED },
        { grant: GRANT_OWNER },
      );
    }
    else if (user != null) {
      grantConditions.push(
        { grant: GRANT_SPECIFIED, grantedUsers: user._id },
        { grant: GRANT_OWNER, grantedUsers: user._id },
      );
    }

    if (showPagesRestrictedByGroup) {
      grantConditions.push(
        { grant: GRANT_USER_GROUP },
      );
    }
    else if (userGroups != null && userGroups.length > 0) {
      grantConditions.push(
        { grant: GRANT_USER_GROUP, grantedGroup: { $in: userGroups } },
      );
    }

    this.query = this.query
      .and({
        $or: grantConditions,
      });

    return this;
  }

  addConditionToPagenate(offset, limit, sortOpt?:any) {
    this.query = this.query
      .sort(sortOpt).skip(offset).limit(limit); // eslint-disable-line newline-per-chained-call

    return this;
  }

  addConditionToListByPathsArray(paths) {
    this.query = this.query
      .and({
        path: {
          $in: paths,
        },
      });

    return this;
  }

  populateDataToList(userPublicFields) {
    this.query = this.query
      .populate({
        path: 'lastUpdateUser',
        select: userPublicFields,
      });
    return this;
  }

  populateDataToShowRevision(userPublicFields) {
    this.query = populateDataToShowRevision(this.query, userPublicFields);
    return this;
  }

}

class Page extends Model {

  static configManager: ConfigManager;

  constructor() {
    super();
    this.configManager = new ConfigManager();
  }

  // this.pageEvent;

  // // init event
  // if (crowi != null) {
  //   pageEvent = crowi.event('page');
  //   pageEvent.on('create', pageEvent.onCreate);
  //   pageEvent.on('update', pageEvent.onUpdate);
  //   pageEvent.on('createMany', pageEvent.onCreateMany);
  // }

  isDeleted() {
    return (this.status === STATUS_DELETED) || isTrashPage(this.path);
  }

  isPublic() {
    if (!this.grant || this.grant === GRANT_PUBLIC) {
      return true;
    }

    return false;
  }

  isTopPage() {
    return isTopPage(this.path);
  }

  isTemplate() {
    return templateChecker(this.path);
  }

  isLatestRevision() {
    // populate されていなくて判断できない
    if (!this.latestRevision || !this.revision) {
      return true;
    }

    // comparing ObjectId with string
    // eslint-disable-next-line eqeqeq
    return (this.latestRevision == this.revision._id.toString());
  }

  async findRelatedTagsById() {
    const PageTagRelation = model('PageTagRelation');
    const relations:any = await PageTagRelation.find({ relatedPage: this._id }).populate('relatedTag');
    return relations.map((relation) => { return relation.relatedTag.name });
  }

  isUpdatable(previousRevision) {
    const revision = this.latestRevision || this.revision;
    // comparing ObjectId with string
    // eslint-disable-next-line eqeqeq
    if (revision != previousRevision) {
      return false;
    }
    return true;
  }

  isLiked(user) {
    if (user == null || user._id == null) {
      return false;
    }

    return this.liker.some((likedUserId) => {
      return likedUserId.toString() === user._id.toString();
    });
  }

  like(userData) {
    return new Promise(((resolve, reject) => {
      const added = this.liker.addToSet(userData._id);
      if (added.length > 0) {
        this.save((err, data) => {
          if (err) {
            return reject(err);
          }
          logger.debug('liker updated!', added);
          return resolve(data);
        });
      }
      else {
        logger.debug('liker not updated');
        return reject();
      }
    }));
  }

  unlike(userData) {
    return new Promise((resolve, reject) => {
      const beforeCount = this.liker.length;
      this.liker.pull(userData._id);
      if (this.liker.length !== beforeCount) {
        this.save((err, data) => {
          if (err) {
            return reject(err);
          }
          return resolve(data);
        });
      }
      else {
        logger.debug('liker not updated');
        return reject();
      }
    });
  }

  isSeenUser(userData) {
    return this.seenUsers.includes(userData._id);
  }

  async seen(userData) {
    if (this.isSeenUser(userData)) {
      logger.debug('seenUsers not updated');
      return this;
    }

    if (!userData || !userData._id) {
      throw new Error('User data is not valid');
    }

    const added = this.seenUsers.addToSet(userData._id);
    const saved = await this.save();

    logger.debug('seenUsers updated!', added);

    return saved;
  }

  getSlackChannel() {
    const extended = this.get('extended');
    if (!extended) {
      return '';
    }

    return extended.slack || '';
  }

  updateSlackChannel(slackChannel) {
    const extended = this.extended;
    extended.slack = slackChannel;

    return this.updateExtended(extended);
  }

  updateExtended(extended) {
    this.extended = extended;
    return new Promise(((resolve, reject) => {
      return this.save((err, doc) => {
        if (err) {
          return reject(err);
        }
        return resolve(doc);
      });
    }));
  }

  initLatestRevisionField(revisionId) {
    this.latestRevision = this.revision;
    if (revisionId != null) {
      this.revision = revisionId;
    }
  }

  populateDataToShowRevision() {
    return populateDataToShowRevision(this, USER_PUBLIC_FIELDS)
      .execPopulate();
  }

  populateDataToMakePresentation(revisionId) {
    this.latestRevision = this.revision;
    if (revisionId != null) {
      this.revision = revisionId;
    }
    return this.populate('revision').execPopulate();
  }

  applyScope(user, grant, grantUserGroupId) {
    // reset
    this.grantedUsers = [];
    this.grantedGroup = null;

    this.grant = grant || GRANT_PUBLIC;

    if (grant !== GRANT_PUBLIC && grant !== GRANT_USER_GROUP) {
      this.grantedUsers.push(user._id);
    }

    if (grant === GRANT_USER_GROUP) {
      this.grantedGroup = grantUserGroupId;
    }
  }

  getContentAge() {
    return differenceInYears(new Date(), this.updatedAt);
  }


  static updateCommentCount(pageId) {

    // return Comment.countCommentByPageId(pageId)
    //   .then((count) => {
    //     this.update({ _id: pageId }, { commentCount: count }, {}, (err, data) => {
    //       if (err) {
    //         logger.debug('Update commentCount Error', err);
    //         throw err;
    //       }

    //       return data;
    //     });
    //   });
  }

  static getGrantLabels() {
    const grantLabels = {};
    grantLabels[GRANT_PUBLIC] = 'Public'; // 公開
    grantLabels[GRANT_RESTRICTED] = 'Anyone with the link'; // リンクを知っている人のみ
    // grantLabels[GRANT_SPECIFIED]  = 'Specified users only'; // 特定ユーザーのみ
    grantLabels[GRANT_USER_GROUP] = 'Only inside the group'; // 特定グループのみ
    grantLabels[GRANT_OWNER] = 'Only me'; // 自分のみ

    return grantLabels;
  }

  static getUserPagePath(user) {
    return `/user/${user.username}`;
  }

  static getDeletedPageName(path) {
    if (path.match('/')) {
      // eslint-disable-next-line no-param-reassign
      path = path.substr(1);
    }
    return `/trash/${path}`;
  }

  static getRevertDeletedPageName(path) {
    return path.replace('/trash', '');
  }

  static isDeletableName() {
    logger.warn('THIS METHOD IS DEPRECATED. Use isDeletablePage method of path-utils instead.');
  }

  static isCreatableName() {
    logger.warn('THIS METHOD IS DEPRECATED. Use isCreatablePage method of path-utils instead.');
  }

  static fixToCreatableName(path) {
    return path
      .replace(/\/\//g, '/');
  }

  static updateRevision(pageId, revisionId, cb) {
    this.update({ _id: pageId }, { revision: revisionId }, {}, (err, data) => {
      cb(err, data);
    });
  }

  /**
   * return whether the user is accessible to the page
   * @param {string} id ObjectId
   * @param {User} user
   */
  static async isAccessiblePageByViewer(id, user) {
    const baseQuery = this.count({ _id: id });

    const userGroups = [];
    if (user != null) {
      // TODO
      // userGroups = await UserGroupRelation.findAllUserGroupIdsRelatedToUser(user);
    }

    const queryBuilder = new PageQueryBuilder(baseQuery);
    queryBuilder.addConditionToFilteringByViewer(user, userGroups, true);

    const count = await queryBuilder.query.exec();
    return count > 0;
  }

  /**
   * @param {string} id ObjectId
   * @param {User} user User instance
   * @param {UserGroup[]} userGroups List of UserGroup instances
   */
  static async findByIdAndViewer(id, user, userGroups) {
    const baseQuery = this.findOne({ _id: id });

    const relatedUserGroups = userGroups;
    if (user != null && relatedUserGroups == null) {
      // relatedUserGroups = await UserGroupRelation.findAllUserGroupIdsRelatedToUser(user);
    }

    const queryBuilder = new PageQueryBuilder(baseQuery);
    queryBuilder.addConditionToFilteringByViewer(user, relatedUserGroups, true);

    return queryBuilder.query.exec();
  }

  // find page by path
  static findByPath(path) {
    if (path == null) {
      return null;
    }
    return this.findOne({ path });
  }

  /**
   * @param {string} path Page path
   * @param {User} user User instance
   * @param {UserGroup[]} userGroups List of UserGroup instances
   */
  static async findByPathAndViewer(path, user, userGroups) {
    if (path == null) {
      throw new Error('path is required.');
    }

    const baseQuery = this.findOne({ path });

    const relatedUserGroups = userGroups;
    if (user != null && relatedUserGroups == null) {
      // relatedUserGroups = await UserGroupRelation.findAllUserGroupIdsRelatedToUser(user);
    }

    const queryBuilder = new PageQueryBuilder(baseQuery);
    queryBuilder.addConditionToFilteringByViewer(user, relatedUserGroups, true);

    return queryBuilder.query.exec();
  }

  /**
   * @param {string} path Page path
   * @param {User} user User instance
   * @param {UserGroup[]} userGroups List of UserGroup instances
   */
  static async findAncestorByPathAndViewer(path, user, userGroups) {
    if (path == null) {
      throw new Error('path is required.');
    }

    if (path === '/') {
      return null;
    }

    const ancestorsPaths = extractToAncestorsPaths(path);

    // pick the longest one
    const baseQuery = this.findOne({ path: { $in: ancestorsPaths } }).sort({ path: -1 });

    const relatedUserGroups = userGroups;
    if (user != null && relatedUserGroups == null) {
      // relatedUserGroups = await UserGroupRelation.findAllUserGroupIdsRelatedToUser(user);
    }

    const queryBuilder = new PageQueryBuilder(baseQuery);
    queryBuilder.addConditionToFilteringByViewer(user, relatedUserGroups);

    return queryBuilder.query.exec();
  }

  static findByRedirectTo(path) {
    return this.findOne({ redirectTo: path });
  }

  /**
   * find pages that is match with `path` and its descendants
   */
  static async findListWithDescendants(path, user, option = {}) {
    const builder = new PageQueryBuilder(this.find());
    builder.addConditionToListWithDescendants(path);

    return this.findListFromBuilderAndViewer(builder, user, false, option);
  }

  /**
   * find pages that is match with `path` and its descendants whitch user is able to manage
   */
  static async findManageableListWithDescendants(page, user, option = {}) {
    if (user == null) {
      return null;
    }

    const builder = new PageQueryBuilder(this.find());
    builder.addConditionToListWithDescendants(page.path);
    builder.addConditionToExcludeRedirect();

    // add grant conditions
    await this.addConditionToFilteringByViewerToEdit(builder, user);

    const { pages } = await this.findListFromBuilderAndViewer(builder, user, false, option);

    // add page if 'grant' is GRANT_RESTRICTED
    // because addConditionToListWithDescendants excludes GRANT_RESTRICTED pages
    if (page.grant === GRANT_RESTRICTED) {
      pages.push(page);
    }

    return pages;
  }


  static async countManageableListWithDescendants(path, user, option = {}) {
    if (user == null) {
      return null;
    }

    const queryBuilder = new PageQueryBuilder(this.count({}));
    queryBuilder.addConditionToListOnlyDescendants(path, option);
    queryBuilder.addConditionToExcludeRedirect();

    const count = await queryBuilder.query.exec();

    return count;
  }

  /**
   * find pages that start with `path`
   */
  static findListByStartWith(path, user, option) {
    // const builder = new PageQueryBuilder(this.find());
    // builder.addConditionToListByStartWith(path, option);

    // return await findListFromBuilderAndViewer(builder, user, false, option);
  }

  /**
   * find pages that is created by targetUser
   *
   * @param {User} targetUser
   * @param {User} currentUser
   * @param {any} option
   */
  static findListByCreator(targetUser, currentUser, option) {
    const opt = Object.assign({ sort: 'createdAt', desc: -1 }, option);
    const builder = new PageQueryBuilder(this.find({ creator: targetUser._id }));

    let showAnyoneKnowsLink = null;
    if (targetUser != null && currentUser != null) {
      showAnyoneKnowsLink = targetUser._id.equals(currentUser._id);
    }

    return this.findListFromBuilderAndViewer(builder, currentUser, showAnyoneKnowsLink, opt);
  }

  static async findListByPageIds(ids, option) {
    const opt:any = Object.assign({}, option);
    const builder = new PageQueryBuilder(this.find({ _id: { $in: ids } }));

    builder.addConditionToExcludeRedirect();
    builder.addConditionToPagenate(opt.offset, opt.limit);

    // count
    const totalCount = await builder.query.exec('count');

    // find
    builder.populateDataToList(USER_PUBLIC_FIELDS);
    const pages = await builder.query.exec('find');

    const result = {
      pages, totalCount, offset: opt.offset, limit: opt.limit,
    };
    return result;
  }


  /**
   * find pages by PageQueryBuilder
   * @param {PageQueryBuilder} builder
   * @param {User} user
   * @param {boolean} showAnyoneKnowsLink
   * @param {any} option
   */
  static async findListFromBuilderAndViewer(builder, user, showAnyoneKnowsLink, option) {

    const opt = Object.assign({ sort: 'updatedAt', desc: -1 }, option);
    const sortOpt = {};
    sortOpt[opt.sort] = opt.desc;

    // exclude trashed pages
    if (!opt.includeTrashed) {
      builder.addConditionToExcludeTrashed();
    }
    // exclude redirect pages
    if (!opt.includeRedirect) {
      builder.addConditionToExcludeRedirect();
    }

    // add grant conditions
    await this.addConditionToFilteringByViewerForList(builder, user, showAnyoneKnowsLink);

    // count
    const totalCount = await builder.query.exec('count');

    // find
    builder.addConditionToPagenate(opt.offset, opt.limit, sortOpt);
    builder.populateDataToList(USER_PUBLIC_FIELDS);
    const pages = await builder.query.exec('find');

    const result = {
      pages, totalCount, offset: opt.offset, limit: opt.limit,
    };
    return result;
  }

  /**
   * Add condition that filter pages by viewer
   *  by considering Config
   *
   * @param {PageQueryBuilder} builder
   * @param {User} user
   * @param {boolean} showAnyoneKnowsLink
   */
  static async addConditionToFilteringByViewerForList(builder, user, showAnyoneKnowsLink) {

    // determine User condition
    const hidePagesRestrictedByOwner = this.configManager.getConfig('crowi', 'security:list-policy:hideRestrictedByOwner');
    const hidePagesRestrictedByGroup = this.configManager.getConfig('crowi', 'security:list-policy:hideRestrictedByGroup');

    // determine UserGroup condition
    const userGroups = null;
    if (user != null) {
      // userGroups = await UserGroupRelation.findAllUserGroupIdsRelatedToUser(user);
    }

    return builder.addConditionToFilteringByViewer(user, userGroups, showAnyoneKnowsLink, !hidePagesRestrictedByOwner, !hidePagesRestrictedByGroup);
  }

  /**
   * Add condition that filter pages by viewer
   *  by considering Config
   *
   * @param {PageQueryBuilder} builder
   * @param {User} user
   * @param {boolean} showAnyoneKnowsLink
   */
  static async addConditionToFilteringByViewerToEdit(builder, user) {

    // determine UserGroup condition
    const userGroups = null;
    if (user != null) {
      // const UserGroupRelation = crowi.model('UserGroupRelation');
      // userGroups = await UserGroupRelation.findAllUserGroupIdsRelatedToUser(user);
    }

    return builder.addConditionToFilteringByViewer(user, userGroups, false, false, false);
  }

  /**
   * Throw error for growi-lsx-plugin (v1.x)
   */
  static generateQueryToListByStartWith(path, user, option) {
    const dummyQuery = this.find();
    // dummyQuery.exec () => {
    //   throw new Error('Plugin version mismatch. Upgrade growi-lsx-plugin to v2.0.0 or above.');
    // };
    return dummyQuery;
  }

  /**
   * find all templates applicable to the new page
   */
  static async findTemplate(path) {
    const templatePath = nodePath.posix.dirname(path);
    const pathList = this.generatePathsOnTree(path, []);
    const regexpList = pathList.map((path) => {
      const pathWithTrailingSlash = pathUtils.addTrailingSlash(path);
      return new RegExp(`^${escapeStringRegexp(pathWithTrailingSlash)}_{1,2}template$`);
    });

    const templatePages = await this.find({ path: { $in: regexpList } })
      .populate({ path: 'revision', model: 'Revision' })
      .exec();

    return this.fetchTemplate(templatePages, templatePath);
  }

  static generatePathsOnTree(path, pathList) {
    pathList.push(path);

    if (path === '/') {
      return pathList;
    }

    const newPath = nodePath.posix.dirname(path);

    return this.generatePathsOnTree(newPath, pathList);
  }

  static assignTemplateByType(templates, path, type) {
    const targetTemplatePath = urljoin(path, `${type}template`);

    return templates.find((template) => {
      return (template.path === targetTemplatePath);
    });
  }

  static assignDecendantsTemplate(decendantsTemplates, path) {
    const decendantsTemplate = this.assignTemplateByType(decendantsTemplates, path, '__');
    if (decendantsTemplate) {
      return decendantsTemplate;
    }

    if (path === '/') {
      return;
    }

    const newPath = nodePath.posix.dirname(path);
    return this.assignDecendantsTemplate(decendantsTemplates, newPath);
  }

  static async fetchTemplate(templates, templatePath) {
    let templateBody;
    let templateTags;
    /**
     * get children template
     * __tempate: applicable only to immediate decendants
     */
    const childrenTemplate = this.assignTemplateByType(templates, templatePath, '_');

    /**
     * get decendants templates
     * _tempate: applicable to all pages under
     */
    const decendantsTemplate = this.assignDecendantsTemplate(templates, templatePath);

    if (childrenTemplate) {
      templateBody = childrenTemplate.revision.body;
      templateTags = await childrenTemplate.findRelatedTagsById();
    }
    else if (decendantsTemplate) {
      templateBody = decendantsTemplate.revision.body;
      templateTags = await decendantsTemplate.findRelatedTagsById();
    }

    return { templateBody, templateTags };
  }

  async pushRevision(pageData, newRevision, user) {
    await newRevision.save();
    logger.debug('Successfully saved new revision', newRevision);

    pageData.revision = newRevision;
    pageData.lastUpdateUser = user;
    pageData.updatedAt = Date.now();

    return pageData.save();
  }

  static async validateAppliedScope(user, grant, grantUserGroupId) {
    if (grant === GRANT_USER_GROUP && grantUserGroupId == null) {
      throw new Error('grant userGroupId is not specified');
    }

    if (grant === GRANT_USER_GROUP) {
      // const count = await UserGroupRelation.countByGroupIdAndUser(grantUserGroupId, user);

      // if (count === 0) {
      //   throw new Error('no relations were exist for group and user.');
      // }
    }
  }

  // static create(
  //     path, body, user, options:PageOptions = {},
  // ) {

  //   // // const Revision = crowi.model('Revision');
  //   // // const format = options.format || 'markdown';
  //   // // const redirectTo = options.redirectTo || null;
  //   // // const grantUserGroupId = options.grantUserGroupId || null;
  //   // // const socketClientId = options.socketClientId || null;

  //   // // // sanitize path
  //   // // path = crowi.xss.process(path); // eslint-disable-line no-param-reassign

  //   // let grant = options.grant;
  //   // // force public
  //   // if (isTopPage(path)) {
  //   //   grant = GRANT_PUBLIC;
  //   // }

  //   // const isExist = await this.count({ path });

  //   // if (isExist) {
  //   //   throw new Error('Cannot create new page to existed path');
  //   // }

  //   // const page = new this();
  //   // page.path = path;
  //   // page.creator = user;
  //   // page.lastUpdateUser = user;
  //   // page.redirectTo = redirectTo;
  //   // page.status = STATUS_PUBLISHED;

  //   // await validateAppliedScope(user, grant, grantUserGroupId);
  //   // page.applyScope(user, grant, grantUserGroupId);

  //   // let savedPage = await page.save();
  //   // const newRevision = Revision.prepareRevision(savedPage, body, null, user, { format });
  //   // const revision = await pushRevision(savedPage, newRevision, user);
  //   // savedPage = await this.findByPath(revision.path);
  //   // await savedPage.populateDataToShowRevision();

  //   // if (socketClientId != null) {
  //   //   pageEvent.emit('create', savedPage, user, socketClientId);
  //   // }
  //   // return savedPage;
  // }

  static async updatePage(pageData, body, previousBody, user, options:PageOptions = {}) {

    // const Revision = crowi.model('Revision');
    const grant = options.grant || pageData.grant; //                                  use the previous data if absence
    const grantUserGroupId = options.grantUserGroupId || pageData.grantUserGroupId; // use the previous data if absence
    const isSyncRevisionToHackmd = options.isSyncRevisionToHackmd;
    const socketClientId = options.socketClientId || null;

    await this.validateAppliedScope(user, grant, grantUserGroupId);
    pageData.applyScope(user, grant, grantUserGroupId);

    // update existing page
    let savedPage = await pageData.save();
    // const newRevision = await Revision.prepareRevision(pageData, body, previousBody, user);
    // const revision = await pushRevision(savedPage, newRevision, user);
    // savedPage = await this.findByPath(revision.path);
    await savedPage.populateDataToShowRevision();

    if (isSyncRevisionToHackmd) {
      savedPage = await this.syncRevisionToHackmd(savedPage);
    }

    if (socketClientId != null) {
      // pageEvent.emit('update', savedPage, user, socketClientId);
    }

    return savedPage;
  }

  static async applyScopesToDescendantsAsyncronously(parentPage, user) {
    const builder = new PageQueryBuilder(this.find());
    builder.addConditionToListWithDescendants(parentPage.path);

    builder.addConditionToExcludeRedirect();

    // add grant conditions
    await this.addConditionToFilteringByViewerToEdit(builder, user);

    // get all pages that the specified user can update
    const pages = await builder.query.exec();

    for (const page of pages) {
      // skip parentPage
      if (page.id === parentPage.id) {
        continue;
      }

      page.applyScope(user, parentPage.grant, parentPage.grantedGroup);
      page.save();
    }
  }

  static removeByPath(path) {
    if (path == null) {
      throw new Error('path is required');
    }
    return this.findOneAndRemove({ path }).exec();
  }

  /**
   * remove the page that is redirecting to specified `pagePath` recursively
   *  ex: when
   *    '/page1' redirects to '/page2' and
   *    '/page2' redirects to '/page3'
   *    and given '/page3',
   *    '/page1' and '/page2' will be removed
   *
   * @param {string} pagePath
   */
  static async removeRedirectOriginPageByPath(pagePath) {
    const redirectPage = await this.findByRedirectTo(pagePath);

    if (redirectPage == null) {
      return;
    }

    // remove
    await this.findByIdAndRemove(redirectPage.id);
    // remove recursive
    await this.removeRedirectOriginPageByPath(redirectPage.path);
  }

  static findListByPathsArray(paths) {
    const queryBuilder = new PageQueryBuilder(this.find());
    queryBuilder.addConditionToListByPathsArray(paths);

    return queryBuilder.query.exec();
  }

  static publicizePage(page) {
    page.grantedGroup = null;
    page.grant = GRANT_PUBLIC;
    return page.save();
  }

  static async transferPageToGroup(page, transferToUserGroupId) {
    const UserGroup = mongoose.model('UserGroup');

    // check page existence
    const isExist = await UserGroup.count({ _id: transferToUserGroupId }) > 0;
    if (isExist) {
      page.grantedGroup = transferToUserGroupId;
      await page.save();
    }
    else {
      throw new Error(`Cannot find the group to which private pages belong to. _id: ${transferToUserGroupId}`);
    }
  }

  /**
   * associate GROWI page and HackMD page
   * @param {Page} pageData
   * @param {string} pageIdOnHackmd
   */
  static registerHackmdPage(pageData, pageIdOnHackmd) {
    pageData.pageIdOnHackmd = pageIdOnHackmd;
    return this.syncRevisionToHackmd(pageData);
  }

  /**
   * update revisionHackmdSynced
   * @param {Page} pageData
   * @param {bool} isSave whether save or not
   */
  static syncRevisionToHackmd(pageData, isSave = true) {
    pageData.revisionHackmdSynced = pageData.revision;
    pageData.hasDraftOnHackmd = false;

    let returnData = pageData;
    if (isSave) {
      returnData = pageData.save();
    }
    return returnData;
  }

  /**
   * update hasDraftOnHackmd
   * !! This will be invoked many time from many people !!
   *
   * @param {Page} pageData
   * @param {Boolean} newValue
   */
  static updateHasDraftOnHackmd(pageData, newValue) {
    if (pageData.hasDraftOnHackmd === newValue) {
      // do nothing when hasDraftOnHackmd equals to newValue
      return;
    }

    pageData.hasDraftOnHackmd = newValue;
    return pageData.save();
  }

  static getHistories() {
    // TODO

  }

}


pageSchema.loadClass(Page);
export default getOrCreateModel<IPage>('Page', pageSchema);