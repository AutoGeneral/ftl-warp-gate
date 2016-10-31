const COMMENT = require('../constants').COMMENT;
const assert = require('assert');

class CommonHelpers {

	/**
	 * @description
	 * Generates HTTP Basic Auth string
	 *
	 * @param {Object} config must contain "username" and "password" fields
	 * @return {Object}
     */
	static getBasicAuthHeaders (config) {
		assert(config.username && config.password, 'Username or password not defined');
		return {
			Authorization: 'Basic ' + new Buffer(config.username + ':' + config.password).toString('base64')
		};
	}

	/**
	 * @description
	 * Searches through properties configuration object
	 * trying to find project by Jira Project Key
	 *
	 * @param {Object} properties
	 * @param {String} jiraProjectKey
	 * @return {Object} project
     */
	static getPropertiesForJiraProject (properties, jiraProjectKey) {
		assert(properties.projects, 'Project properties are not defined');
		return properties.projects.find(item => item.jiraProjectKey === jiraProjectKey);
	}

	/**
	 * @description
	 * Searches through properties configuration object
	 * trying to find project that matches these requirements:
	 * - has one of the Bamboo Deployment Plans defined in deploymentPlansIds
	 * - has at least partial match with Bamboo Build Plan Result Key
	 *
	 * For example this project
	 * {
	 *	"jiraProjectKey": "WHAT",
	 *	"bambooBuildPlanKey": "WL-BFT",
	 *	"bambooDeploymentId": 61276164
	 * }
	 * will match getPropertiesForDeployment(properties, [61276164, 61276199], 'WL-BFT9-14')
	 *
	 * @param {Object} properties
	 * @param {Array<Number>} deploymentPlansIds
	 * @param {String} planResultKey
	 * @return {Object} project
	 */
	static getPropertiesForDeployment (properties, deploymentPlansIds, planResultKey) {
		assert(properties.projects, 'Project properties are not defined');
		return properties.projects
			.filter(item => deploymentPlansIds.indexOf(item.bambooDeploymentId) !== -1)
			.find(item => planResultKey.indexOf(item.bambooBuildPlanKey) !== -1);
	}

	/**
	 * @description
	 * Formats error to make it look good in Jira comment
	 *
	 * @param {Object} err
	 * @return {String}
     */
	static formatErrorForJira (err) {
		return `${COMMENT.HEADER}{color:red}*${err}*{color}\n${err.stack ? `{code}${err.stack}{code}` : ''}`;
	}
}

module.exports = CommonHelpers;
