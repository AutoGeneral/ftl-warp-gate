'use strict';

const HTTP_METHOD = require('../constants').HTTP_METHOD;
const assert = require('assert');
const logger = require('winston');
const request = require('request-promise');
const moment = require('moment');
const helpers = require('../helpers');


/**
 * @class
 * @description
 * Class to iteract with Bamboo Jira API, all methods return Promises
 * using request-promise library
 */
class Jira {

	constructor (config) {
		assert(config, 'Jira configuration is not defined');
		this._config = config;
	}

	/**
	 * @description
	 * https://docs.atlassian.com/jira/REST/cloud/#api/2/issue-addComment
	 *
	 * @param {String} issueKey
	 * @param {String} comment
	 * @param {Object} [visibility]
	 * @return {Promise}
     */
	addComment (issueKey, comment, visibility) {
		logger.debug(`Executed (issueKey: ${issueKey})`);
		assert(issueKey, 'issueKey must be defined');
		assert(comment, 'comment must be defined');
		return request({
			uri: `${this._config.baseUrl}/rest/api/2/issue/${issueKey}/comment`,
			method: HTTP_METHOD.POST,
			headers: helpers.getBasicAuthHeaders(this._config),
			body: {
				body: comment,
				visibility
			},
			json: true
		});
	}

	/**
	 * @description
	 * https://docs.atlassian.com/jira/REST/cloud/#api/2/issue-getIssue
	 *
	 * @param {String} issueKey
	 * @param {String} [expand]
	 * @return {Promise}
     */
	getIssue (issueKey, expand) {
		logger.debug(`Executed (issueKey: ${issueKey})`);
		assert(issueKey, 'issueKey must be defined');
		return request({
			uri: `${this._config.baseUrl}/rest/api/2/issue/${issueKey}?expand=${expand || ''}`,
			method: HTTP_METHOD.GET,
			headers: helpers.getBasicAuthHeaders(this._config),
			json: true
		});
	}

	/**
	 * @description
	 * https://docs.atlassian.com/jira/REST/cloud/#api/2/issue-doTransition
	 *
	 * @param {String} issueKey
	 * @param {String} transitionId
	 * @return {Promise}
     */
	transition (issueKey, transitionId) {
		logger.debug(`Executed (issueKey: ${issueKey})`);
		assert(issueKey, 'issueKey must be defined');
		assert(transitionId, 'transitionId must be defined');
		return request({
			uri: `${this._config.baseUrl}/rest/api/2/issue/${issueKey}/transitions`,
			method: HTTP_METHOD.POST,
			headers: helpers.getBasicAuthHeaders(this._config),
			body: {
				transition: {
					id: transitionId
				}
			},
			json: true
		});
	}

	/**
	 * @description
	 * https://docs.atlassian.com/jira/REST/cloud/#api/2/version-createVersion
	 *
	 * @param {String} projectKey
	 * @param {String} name
	 * @param {String} [description]
	 * @return {Promise}
     */
	createNewProjectVersion (projectKey, name, description) {
		logger.debug(`Executed (projectKey: ${projectKey}, name: ${name})`);
		assert(projectKey, 'projectKey must be defined');
		assert(name, 'name must be defined');
		return request({
			uri: `${this._config.baseUrl}/rest/api/2/version`,
			method: HTTP_METHOD.POST,
			headers: helpers.getBasicAuthHeaders(this._config),
			body: {
				description: description || '',
				name: name,
				project: projectKey,
				startDate: moment().format('YYYY-MM-DD')
			},
			json: true
		});
	}

	/**
	 * @description
	 * https://docs.atlassian.com/jira/REST/cloud/#api/2/issue-editIssue
	 *
	 * @param {String} issueKey
	 * @param {Number|String} versionId
	 * @return {Promise}
     */
	addIssueToProjectVersion (issueKey, versionId) {
		logger.debug(`Executed (issueKey: ${issueKey}, versionId: ${versionId})`);
		assert(issueKey, 'issueKey must be defined');
		assert(versionId, 'versionId must be defined');
		return request({
			uri: `${this._config.baseUrl}/rest/api/2/issue/${issueKey}`,
			method: HTTP_METHOD.PUT,
			headers: helpers.getBasicAuthHeaders(this._config),
			body: {
				update: {
					fixVersions: [{'set':[{id : versionId}]}]
				}
			},
			json: true
		});
	}

	/**
	 * @description
	 * Marks Jira project version as released with current date
	 * https://docs.atlassian.com/jira/REST/cloud/#api/2/version-updateVersion
	 *
	 * @param {String|Number} versionId
	 * @return {Promise}
	 */
	releaseProjectVersion (versionId) {
		logger.debug(`Executed (versionId: ${versionId})`);
		assert(versionId, 'versionId must be defined');
		return request({
			uri: `${this._config.baseUrl}/rest/api/2/version/${versionId}`,
			method: HTTP_METHOD.PUT,
			headers: helpers.getBasicAuthHeaders(this._config),
			body: {
				released: true,
				releaseDate: moment().format('YYYY-MM-DD')
			},
			json: true
		});
	}

	/**
	 * @description
	 * Requests Jira API to return list of issues with certain labels and NOT certain statuses
	 * https://docs.atlassian.com/jira/REST/cloud/#api/2/search-search
	 *
	 * @param {String} projectKey
	 * @param {String|Array<String>} labels
	 * @param {String|Array<String>} allowedStatuses
	 * @return {Promise}
     */
	getUnreleasedFtlIssuesForProject (projectKey, labels, allowedStatuses) {
		logger.debug(`Executed (projectKey: ${projectKey})`);
		const formattedLabels = [].concat(labels).map(item => `"${item}"`).join(',');
		const formatttedStatuses = [].concat(allowedStatuses).map(item => `"${item}"`).join(',');

		assert(projectKey, 'versionId must be defined');
		assert(formattedLabels.length, 'At least one label must be specified');
		assert(formatttedStatuses.length, 'At least one done status must be specified');

		const jql = `project = ${projectKey} AND status not in (${formatttedStatuses}) AND labels in (${formattedLabels})`;

		return request({
			uri: `${this._config.baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}`,
			method: HTTP_METHOD.GET,
			headers: helpers.getBasicAuthHeaders(this._config),
			json: true
		});
	}


}

module.exports = Jira;
