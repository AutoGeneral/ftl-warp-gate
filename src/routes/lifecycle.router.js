'use strict';

const COMMENT = require('../constants').COMMENT;
const ERROR = require('../constants').ERROR;
const TOO_MANY_FTL_EXCEPTION_MESSAGE = 'TOO_MANY_FTL';

const assert = require('assert');
const logger = require('winston');

const helpers = require('../helpers');
const Jira = require('../core/jira');
const Bamboo = require('../core/bamboo');
const TransitionRouter = require('./transition.router');

class IssueLifecycleRouter {

	constructor (app) {
		assert(app.config.properties, 'Properties are not defined');
		this._config = app.config;
		this._jira = new Jira(app.config.jira);
		this._bamboo = new Bamboo(app.config.bamboo);

		/**
		 * @api {post} /api/issue/:issueKey/build Build
		 * @apiName Build
		 * @apiGroup Lifecycle
		 * @apiVersion 1.0.0
		 *
		 * @apiDescription
		 * Creates and queue a new build in Bamboo for this issue
		 *
		 * This route was designed to be called by webhooks from Jira so it expect standard webhook params.
		 * Read more: https://developer.atlassian.com/jiradev/jira-apis/webhooks
		 *
		 * @apiParam {String} issueKey
		 * @apiParam {Object} issue
		*/
		app.server.post('/api/issue/:issueKey/build', this.build.bind(this));

		/**
		 * @api {post} /api/issue/:issueKey/release Release
		 * @apiName Release
		 * @apiGroup Lifecycle
		 * @apiVersion 1.0.0
		 *
		 * @apiDescription
		 * Release a project version with this issue
		 *
		 * @apiParam {String} issueKey
		 */
		app.server.post('/api/issue/:issueKey/release', this.release.bind(this));

		logger.debug('IssueLifecycleRouter has been loaded');
	}

	/**
	 * @description
	 * Does these things:
	 * - checks that there no other FTL tickets for this project that in progress (allowed statuses)
	 * - gets mappings from properties files
	 * - searches for release build plan in Bamboo
	 * - creates new custom build in Bamboo
	 *
	 * @param {Object} req
	 * @param {Object} res
	 * @return {*}
     */
	build (req, res) {
		let releaseBranch;

		assert(req.body.issue, 'Issue must be specified in the body');
		const projectKey = req.body.issue.fields.project.key;
		const issueKey = req.body.issue.key;

		const properties = helpers.getPropertiesForJiraProject(this._config.properties, projectKey);
		assert(properties, `There are no FTL mappings for project ${projectKey}`);

		if (req.body.issue.fields.labels.indexOf(this._config.properties.label) === -1) {
			logger.debug(`Issue ${req.body.issue.key} doesn't have label for FTL deployment`);
			return helpers.successResponse(res);
		}
		return this._jira.getUnreleasedFtlIssuesForProject(
			projectKey,
			this._config.properties.label,
			this._config.properties.allowMultipleFTLsWithStatuses
		)
			.then(data => {
				if (data.issues.length > 1) {
					this._jira.addComment(issueKey, COMMENT.HEADER
						+ 'Can\'t start FTL workflow as there are other unreleased FTL issues for this project:'
						+ data.issues.filter(issue => issue.key !== issueKey).map(issue => `\n${issue.key}`).join('')
					);
					TransitionRouter.getTransitionFunction(this._jira, this._config.properties, 'thingsWentWrong')(issueKey);
					throw new Error(TOO_MANY_FTL_EXCEPTION_MESSAGE);
				}
				return this._bamboo.getPlanBranches(properties.bambooBuildPlanKey);
			})
			.then(data => {
				const branches = data.branches.branch;

				releaseBranch = branches.find(branch => branch.shortName === properties.releaseBranch);
				assert(releaseBranch, `No release branch found for build plan ${properties.bambooBuildPlanKey}`);

				return this._bamboo.addToBuildQueue(releaseBranch.key, {
					'bamboo.variable.isFTL': true,
					'bamboo.variable.issueKey': issueKey
				});
			})
			.then(data => {
				this._jira.addComment(issueKey, COMMENT.READY_FOR_PRELIVE);
				this._jira.addComment(
					issueKey,
					`${COMMENT.HEADER}Bamboo is building release: [#${data.buildNumber}|${this._config.bamboo.baseUrl}/browse/${data.buildResultKey}]`,
					this._config.properties.commentsVisibility.IT
				);

				helpers.successResponse(res, data);
			})
			.catch(err => {
				logger.warn(err);
				helpers.failResponse(res, {message: ERROR.INTERNAL});

				// We don't need to post exception stack in case if we have too many ftl issues
				// as we already have a nice message for that error
				if (err.message !== TOO_MANY_FTL_EXCEPTION_MESSAGE) {
					this._jira.addComment(
						issueKey,
						helpers.formatErrorForJira(err),
						this._config.properties.commentsVisibility.IT
					);
				}
			});
	}

	/**
	 * @description
	 * Searches for the project version (fixVersion) that contain the issue and mark it as released
	 * Please note: this method will throw error if issue belongs to multiple versions
	 *
	 * @param {Object} req
	 * @param {Object} res
	 * @return {*}
     */
	release (req, res) {
		const issueKey = req.params.issueKey;
		assert(issueKey, 'Issue must be specified');

		this._jira.getIssue(issueKey)
			.then(issue => {
				assert(issue, `Issue ${issueKey} not found`);
				assert(issue.fields.fixVersions.length, `There are no release versions with ${issueKey}`);
				assert(issue.fields.fixVersions.length === 1, `There are too many release versions with ${issueKey}`);

				return this._jira.releaseProjectVersion(issue.fields.fixVersions[0].id);
			})
			.then(() => helpers.successResponse(res))
			.catch(err => {
				logger.warn(err);
				helpers.failResponse(res, {message: ERROR.INTERNAL});

				this._jira.addComment(
					issueKey,
					helpers.formatErrorForJira(err),
					this._config.properties.commentsVisibility.IT
				);
			});
	}
}

module.exports = IssueLifecycleRouter;
