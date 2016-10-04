'use strict';

const HTTP_METHOD = require('../constants').HTTP_METHOD;
const assert = require('assert');
const logger = require('winston');
const request = require('request-promise');
const helpers = require('../helpers');

/**
 * @class
 * @description
 * Class to iteract with Bamboo REST API, all methods return Promises
 * using request-promise library
 */
class Bamboo {

	constructor (config) {
		assert(config, 'Bamboo configuration is not defined');
		this._config = config;
	}

	/**
	 * @description
	 * https://docs.atlassian.com/bamboo/REST/5.12.3.1/#d2e1118
	 *
	 * @param {String} buildPlanKey
	 * @return {Promise}
     */
	getPlanBranches (buildPlanKey) {
		logger.debug(`Executed (buildPlanKey: ${buildPlanKey})`);
		assert(buildPlanKey, 'buildPlanKey must be defined');
		return request({
			uri: `${this._config.baseUrl}/rest/api/latest/plan/${buildPlanKey}?expand=branches&max-result=100`,
			method: HTTP_METHOD.GET,
			headers: helpers.getBasicAuthHeaders(this._config),
			json: true
		});
	}

	/**
	 * @description
	 * https://docs.atlassian.com/bamboo/REST/5.12.3.1/#d2e1865
	 *
	 * @param {String} planKey
	 * @return {Promise}
     */
	getDeploymentProjectsForPlan (planKey) {
		logger.debug(`Executed (planKey: ${planKey})`);
		assert(planKey, 'planKey must be defined');
		return request({
			uri: `${this._config.baseUrl}/rest/api/latest/deploy/project/forPlan?planKey=${planKey}`,
			method: HTTP_METHOD.GET,
			headers: helpers.getBasicAuthHeaders(this._config),
			json: true
		});
	}

	/**
	 * @description
	 * https://docs.atlassian.com/bamboo/REST/5.12.3.1/#d2e1707
	 *
	 * @param {String|Number} deploymentId
	 * @return {Promise}
     */
	getDeploymentProjectById (deploymentId) {
		logger.debug(`Executed (deploymentId: ${deploymentId})`);
		assert(deploymentId, 'deploymentId must be defined');
		return request({
			uri: `${this._config.baseUrl}/rest/api/latest/deploy/project/${deploymentId}`,
			method: HTTP_METHOD.GET,
			headers: helpers.getBasicAuthHeaders(this._config),
			json: true
		});
	}

	/**
	 * @description
	 * https://docs.atlassian.com/bamboo/REST/5.12.3.1/#d2e991
	 *
	 * @param {String|Number} environmentId
	 * @param {Number} [maxResult=10]
	 * @return {Promise}
     */
	getLatestDeploymentVersionsForEnvironment (environmentId, maxResult) {
		logger.debug(`Executed (environmentId: ${environmentId})`);
		assert(environmentId, 'environmentId must be defined');
		return request({
			uri: `${this._config.baseUrl}/rest/api/latest/deploy/environment/${environmentId}/results?max-result=${maxResult || 10}`,
			method: HTTP_METHOD.GET,
			headers: helpers.getBasicAuthHeaders(this._config),
			json: true
		});
	}

	/**
	 * @description
	 * https://docs.atlassian.com/bamboo/REST/5.12.3.1/#d2e855
	 *
	 * @param {String} releaseBranchKey
	 * @param {Object} variables
	 * @return {Promise}
     */
	addToBuildQueue (releaseBranchKey, variables) {
		logger.debug(`Executed (releaseBranchKey: ${releaseBranchKey})`);
		assert(releaseBranchKey, 'releaseBranchKey must be defined');
		assert(variables, 'variables must be defined');
		return request({
			uri: `${this._config.baseUrl}/rest/api/latest/queue/${releaseBranchKey}?executeAllStages`,
			method: HTTP_METHOD.POST,
			headers: helpers.getBasicAuthHeaders(this._config),
			json: true,
			form: variables
		});
	}

	/**
	 * @description
	 * https://docs.atlassian.com/bamboo/REST/5.12.3.1/#d2e2019
	 *
	 * @param {String|Number} environmentId
	 * @param {String|Number} deploymentVersionId
	 * @return {Promise}
     */
	addToDeploymentQueue (environmentId, deploymentVersionId) {
		logger.debug(`Executed (environmentId: ${environmentId}, deploymentVersionId: ${deploymentVersionId})`);
		assert(environmentId, 'environmentId must be defined');
		assert(deploymentVersionId, 'deploymentVersionId must be defined');
		return request({
			uri: `${this._config.baseUrl}/rest/api/latest/queue/deployment?environmentId=${environmentId}&versionId=${deploymentVersionId}`,
			method: HTTP_METHOD.POST,
			headers: helpers.getBasicAuthHeaders(this._config)
		});
	}

	/**
	 * @description
	 * https://docs.atlassian.com/bamboo/REST/5.12.3.1/#d2e1813
	 *
	 * @param {String|Number} deploymentId
	 * @param {String} planResultKey
	 * @param {String} deploymentName
	 * @return {Promise}
     */
	createNewDeploymentVersion (deploymentId, planResultKey, deploymentName) {
		logger.debug(`Executed (deploymentId: ${deploymentId}, planResultKey: ${planResultKey})`);
		assert(deploymentId, 'deploymentId must be defined');
		assert(planResultKey, 'planResultKey must be defined');
		assert(deploymentName, 'deploymentName must be defined');
		return request({
			uri: `${this._config.baseUrl}/rest/api/latest/deploy/project/${deploymentId}/version`,
			method: HTTP_METHOD.POST,
			headers: helpers.getBasicAuthHeaders(this._config),
			body: {
				planResultKey: planResultKey,
				name: deploymentName
			},
			json: true
		});
	}

	/**
	 * @description
	 * https://docs.atlassian.com/bamboo/REST/5.12.3.1/#d2e603
	 *
	 * @param {String|Number} deploymentResultId
	 * @return {Promise}
	 */
	getDeploymentResult (deploymentResultId) {
		logger.debug(`Executed (deploymentResultId: ${deploymentResultId})`);
		assert(deploymentResultId, 'deploymentName must be defined');
		return request({
			uri: `${this._config.baseUrl}/rest/api/latest/deploy/result/${deploymentResultId}`,
			method: HTTP_METHOD.GET,
			headers: helpers.getBasicAuthHeaders(this._config),
			json: true
		});
	}
}

module.exports = Bamboo;
