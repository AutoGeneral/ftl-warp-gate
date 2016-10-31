const assert = require('assert');
const logger = require('winston');

const {ResponseHelpers} = require('../helpers');
const Jira = require('../core/jira');


class TransitionRouter {

	constructor (app) {
		assert(app.config.properties, 'Properties are not defined');
		this._config = app.config;
		this._jira = new Jira(app.config.jira);

		logger.debug('TransitionRouter has been loaded');
	}

	/**
	 *
	 * @param {Object} jira
	 * @param {Object} properties
	 * @param {String} transitionCode
	 * @return {function(req, [res]): Promise}
     */
	static getTransitionFunction (jira, properties, transitionCode) {

		/**
		 * @param {String} issueKey
		 * @param {Object} res
		 * @return {Promise}
         */
		return (issueKey, res) => {
			logger.debug('Executed');
			return jira.getIssue(issueKey, 'transitions')
				.then(data => {
					if (data.fields.labels.indexOf(properties.label) === -1) {
						throw new Error(`Issue ${issueKey} doesn't have label for FTL deployment and will be ignored`);
					}

					assert(data.transitions, `There are no known transitions for issue ${issueKey}`);
					const transitions = data.transitions;

					assert(properties.transitions[transitionCode], `Properties.transitions.${transitionCode} is not defined`);
					const transitionName = properties.transitions[transitionCode];
					const targetTransition = transitions.find(transition => transition.name.toLowerCase() === transitionName.toLowerCase());

					if (!targetTransition) {
						throw new Error(`Transition "${transitionName}" not available for issue ${issueKey}, ignore it if that was YOLO mode`);
					}

					return jira.transition(issueKey, targetTransition.id);
				})
				.then(() => {
					logger.info('success');
					if (res) ResponseHelpers.success(res);
				});
		};
	}
}

module.exports = TransitionRouter;
