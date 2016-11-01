// Read the description below
const ASYNC_DELAY = 20 * 1000; // 20 sec
const PROD_ENVIRONMENT_START_WAIT = 5 * 60 * 1000; // 5 min
// Will be used in release name, also the program will search for this prefix
// when it promotes releases from prelive to production
const FTL_BUILD_NAME_PREFIX = 'FTL';
const COMMENT = require('../constants').COMMENT;
const COLOUR = require('../constants').COLOUR;
const DEPLOYMENT_STATE = require('../constants').DEPLOYMENT_STATE;

const assert = require('assert');
const moment = require('moment');
const logger = require('winston');

const TransitionRouter = require('./transition.router');
const Bamboo = require('../core/bamboo');
const Jira = require('../core/jira');
const ProductionColourResolver = require('../core/colours');
const {ResponseHelpers, CommonHelpers} = require('../helpers');


class DeploymentRouter {

	constructor (app) {
		this._config = app.config;
		this._bamboo = new Bamboo(app.config.bamboo);
		this._jira = new Jira(app.config.jira);

		/**
		 * @api {post} /api/issue/:issueKey/deploy/prelive Deploy to Prelive
		 * @apiName DeployToPrelive
		 * @apiGroup Deployment
		 * @apiVersion 1.0.0
		 *
		 * @apiDescription
		 * Create new deployment and deploy it to prelive
		 *
		 * @apiParam {String} planResultKey
		 * @apiParam {String} issueKey
		*/
		app.server.post('/api/issue/:issueKey/deploy/prelive', this.preliveDeployment.bind(this));

		/**
		 * @api {post} /api/:issueKey/deploy/production Deploy to Production
		 * @apiName DeployToProduction
		 * @apiGroup Deployment
		 * @apiVersion 1.0.0
		 *
		 * @apiDescription
		 * Use existing deployment version from prelive environment and deploy it to production.
		 * As part of this method the system will try to understand what is the current production
		 * colour and deploy to opposite one. Also as colour opposite to the current production
		 * is usually offline this system will try to start those instances.
		 *
		 * This route was designed to be called by webhooks from Jira so it expect standard webhook params.
		 * Read more: https://developer.atlassian.com/jiradev/jira-apis/webhooks
		 *
		 * @apiParam {String} issueKey
		 * @apiParam {Object} issue
		 */
		app.server.post('/api/issue/:issueKey/deploy/production', this.productionDeployment.bind(this));

		/**
		 * @api {post} /api/issue/:issueKey/deploy/yolo YOLO deployment
		 * @apiName YoloDeploy
		 * @apiGroup Deployment
		 * @apiVersion 1.0.0
		 *
		 * @apiDescription
		 * Create new deployment and deploy it to prelive AND to production. Basically do the same
		 * thing as previous two methdos
		 *
		 * @apiParam {String} planResultKey
		 * @apiParam {String} issueKey
		 */
		app.server.post('/api/issue/:issueKey/deploy/yolo', this.yoloDeployment.bind(this));

		/**
		 * @api {post} /api/issue/:issueKey/deploy/check Validate deployment
		 * @apiName ValidateDeploy
		 * @apiGroup Deployment
		 * @apiVersion 1.0.0
		 *
		 * @apiDescription
		 * Check deployment result in Bamboo and post comment to Jira ticket if it failed
		 * Call is async so it will always return 200 OK as a response
		 *
		 * It will execute transition if deployment was successful and transitionCode is defined
		 *
		 * @apiParam {String} resultsUrl
		 * @apiParam {String} issueKey
		 * @apiParam {String} [transitionCode]
		 */
		app.server.post('/api/issue/:issueKey/deploy/validate', this.validateDeployment.bind(this));

		logger.debug('DeploymentRouter has been loaded');
	}

	preliveDeployment (req, res) {
		const planResultKey = req.body.planResultKey;
		const issueKey = req.body.issueKey;

		if (!issueKey) return ResponseHelpers.fail(res);

		// Here we go ... all the FTL travels should involve some magic, right?
		//
		// There are no webhooks that we can use after the build is finished in Bamboo
		// so this route should be called AS PART OF THE ACTUAL BUILD. It means that build is not completed yet
		// and as you should know you can't create a release for uncompleted build.
		//
		// As a result we have to pray and wait some time until the current build will be completed
		// We can pull status every minute or just add a timeout and hope that is enough
		//
		// TODO: Think about redesign (ONLINE-350)
		//
		setTimeout(() => {
			this.startNewPreliveDeployment(planResultKey, issueKey)
				.catch(err => {
					logger.warn(err);
					this._jira.addComment(
						issueKey,
						CommonHelpers.formatErrorForJira(err),
						this._config.properties.commentsVisibility.IT
					);
				});
		}, ASYNC_DELAY);

		// Return positive result as we want Bamboo build job to be completed asap
		ResponseHelpers.success(res);
	}

	productionDeployment (req, res) {
		const issueKey = req.body.issue.key;
		const projectKey = req.body.issue.fields.project.key;

		if (!issueKey || !projectKey) return ResponseHelpers.fail(res);

		setTimeout(() => {
			this.startNewProductionDeployment(projectKey, issueKey)
				.catch(err => {
					logger.warn(err);
					this._jira.addComment(
						issueKey,
						CommonHelpers.formatErrorForJira(err),
						this._config.properties.commentsVisibility.IT
					);
				});
		}, ASYNC_DELAY);

		// Return positive result as we want Bamboo build job to be completed asap
		ResponseHelpers.success(res);
	}

	yoloDeployment (req, res) {
		const planResultKey = req.body.planResultKey;
		const issueKey = req.body.issueKey;

		if (!issueKey) return ResponseHelpers.fail(res);

		// Read about this setTimeout magic in comments for `preliveDeployment` above
		setTimeout(() => {

			// TODO: Should we notify users about YOLO mode?
			// this._jira.addComment(issueKey, COMMENT.YOLO_MODE);

			// We will start prelive deployment, and transition through
			// Production deployment should be triggered as a workflow transition
			this.startNewPreliveDeployment(planResultKey, issueKey)
				.then(() => {
					return TransitionRouter.getTransitionFunction(this._jira, this._config.properties, 'deployedToPrelive')(issueKey);
				})
				.then(() => {
					return TransitionRouter.getTransitionFunction(this._jira, this._config.properties, 'pass')(issueKey);
				})
				.catch(err => {
					logger.warn(err);
					this._jira.addComment(
						issueKey,
						CommonHelpers.formatErrorForJira(err),
						this._config.properties.commentsVisibility.IT
					);
				});
		}, ASYNC_DELAY);

		// Return positive result as we want Bamboo build job to be completed asap
		ResponseHelpers.success(res);
	}

	/**
	 * @description
	 * Does these things:
	 * - creates a new Jira Project version and adds issue into it
	 * - creates a new Bamboo Deployment version with the same name
	 * - starts deployment to Prelive environment
	 *
	 * @param {String} planResultKey
	 * @param {String} issueKey
	 * @return {Promise}
     */
	startNewPreliveDeployment (planResultKey, issueKey) {
		assert(planResultKey, 'planResultKey body param must be defined');
		assert(issueKey, 'issueKey body param must be defined');

		logger.debug(`Executed (planResultKey: ${planResultKey}, issueKey: ${issueKey}`);

		const deploymentName = `${FTL_BUILD_NAME_PREFIX} ${moment().format('DD/MM/YYYY hh:mm')}`;
		// Extract projectKey from issueKey: for example, CQS from CQS-21
		const projectKey = issueKey.replace(/(.*)-.*?$/, '$1');

		let deploymentVersionId;
		let properties;

		return TransitionRouter.getTransitionFunction(this._jira, this._config.properties, 'deployToPrelive')(issueKey)
			.then(() => {
				return this._jira.createNewProjectVersion(projectKey, deploymentName, 'FTL');
			})
			.then(projectVersion => {
				return this._jira.addIssueToProjectVersion(issueKey, projectVersion.id);
			})
			.then(() => {
				return this._bamboo.getDeploymentProjectsForPlan(planResultKey);
			})
			.then(data => {
				const deploymentPlansIds = data.map(plan => plan.id);
				properties = CommonHelpers.getPropertiesForDeployment(this._config.properties, deploymentPlansIds, planResultKey);
				assert(properties, `No project properties found for planResultKey: ${planResultKey}, deploymentPlansIds: ${deploymentPlansIds}`);

				return this._bamboo.createNewDeploymentVersion(properties.bambooDeploymentId, planResultKey, deploymentName);
			})
			.then(data => {
				assert(data.id, 'Deployment version id is not returned by API');
				deploymentVersionId = data.id;
				return this._bamboo.getDeploymentProjectById(properties.bambooDeploymentId);
			})
			.then(data => {
				assert(this._config.properties.environments, 'Environments properties are not defined');
				assert(this._config.properties.environments.prelive, 'Prelive properties are not defined');

				const environments = data.environments;
				const environment = environments.find(env => env.name === this._config.properties.environments.prelive);
				assert(environment, 'Prelive environment not found as target deployment');

				return this._bamboo.addToDeploymentQueue(environment.id, deploymentVersionId);
			});
	}

	/**
	 * @description
	 * Does these things:
	 * - gets current production colour and finds target production environment
	 * - starts target environment assuming it was down
	 * - promotes latest FTL build from prelive to production
	 *
	 * @param {String} projectKey
	 * @param {String} issueKey
	 * @return {Promise}
     */
	startNewProductionDeployment (projectKey, issueKey) {
		const properties = CommonHelpers.getPropertiesForJiraProject(this._config.properties, projectKey);
		assert(properties, `There are no FTL mappings for project ${projectKey}`);

		logger.debug(`Executed (projectKey: ${projectKey}, issueKey: ${issueKey}`);

		let targetColour;
		let targetStartEnvironmentId;
		let preliveEnvironment;
		let productionEnvironment;

		return TransitionRouter.getTransitionFunction(this._jira, this._config.properties, 'deployToProduction')(issueKey)
			.then(() => {
				const colourResolver = new ProductionColourResolver(this._config.properties.productionColoursUrl);
				return colourResolver.getColour();
			})
			.then(currentColour => {
				if (currentColour === COLOUR.GREEN) targetColour = COLOUR.BLUE;
				else if (currentColour === COLOUR.BLUE) targetColour = COLOUR.GREEN;
				assert(targetColour, 'Cannot set target production colour');

				targetStartEnvironmentId = this._config.properties.environmentLifecycle[targetColour].start;
				assert(targetStartEnvironmentId, 'Cannot find Bamboo deployment environment to start');

				return this._bamboo.getLatestDeploymentVersionsForEnvironment(targetStartEnvironmentId, 1);
			})
			.then(data => {
				assert(data.results.length, 'Lifecycle control environments require at least one deployed version');
				const deploymentVersion = data.results[0].deploymentVersion;
				return this._bamboo.addToDeploymentQueue(targetStartEnvironmentId, deploymentVersion.id);
			})
			.then(() => {
				return this._bamboo.getDeploymentProjectById(properties.bambooDeploymentId);
			})
			.then(data => {
				assert(this._config.properties.environments, 'Environments properties are not defined');

				preliveEnvironment = data.environments.find(env => env.name === this._config.properties.environments.prelive);
				productionEnvironment = data.environments.find(env => env.name === this._config.properties.environments.production[targetColour]);
				assert(preliveEnvironment, 'Prelive environment not found as target deployment');
				assert(productionEnvironment, 'Production environment not found as target deployment');

				return this._bamboo.getLatestDeploymentVersionsForEnvironment(preliveEnvironment.id, 50);
			})
			.then(data => {
				assert(data.results.length, 'No deployments found for prelive environment');

				// Get the latest deployment version that matches FTL name
				let deploymentVersion = data.results.find(result => result.deploymentVersion.name.indexOf(FTL_BUILD_NAME_PREFIX) !== -1);
				assert(deploymentVersion, `No recent deployments matching '${FTL_BUILD_NAME_PREFIX}' pattern were found for prelive environment`);

				// Bamboo please ... ರ_ರ
				deploymentVersion = deploymentVersion.deploymentVersion;

				this._jira.addComment(
					issueKey,
					`${COMMENT.HEADER} Issue will be deployed to Production "${targetColour.toUpperCase()}"`
					+ ` in ${(PROD_ENVIRONMENT_START_WAIT / 60000).toFixed(2)} mins`
					+ ` as release [${deploymentVersion.name}|${this._config.bamboo.baseUrl}/deploy/viewDeploymentVersion.action?versionId=${deploymentVersion.id}].`
					+ ` Environment is starting...`,
					this._config.properties.commentsVisibility.IT
				);

				// We have no idea when our target production environment will finish starting and will be
				// ready for our deployments. As a result we don't know when we should deploy
				//
				// There a few options how we can find that:
				// a) poll every N secs info from ELB attached to app servers to see if all the slaves are up
				// b) push data from statuscheck app to some unknown place that will exceute warp gate endpoint
				// c) wait N secs and just deploy things assuming there was enough time for env to init
				//
				// For first version of warp gate plan c) is the way:
				setTimeout(() => {
					return this._bamboo.addToDeploymentQueue(productionEnvironment.id, deploymentVersion.id);
				}, PROD_ENVIRONMENT_START_WAIT);
			});
	}

	validateDeployment (req, res) {
		const issueKey = req.body.issueKey || req.params.issueKey;
		const resultsUrl = req.body.resultsUrl;
		const transitionCode = req.body.transitionCode;

		assert(issueKey, 'issueKey body or url param must be defined');
		assert(resultsUrl, 'resultsUrl body param must be defined');

		// It looks like resultsUrl is the only variable in Bamboo deployment we can use to get
		// the current deployment result id. Its value is something like this:
		// http://bamboodev.budgetdirect.com.au:8085/deploy/viewDeploymentResult.action?deploymentResultId=67797436
		//
		// So we are going to extract that number from this string
		const deploymentResultId = resultsUrl.split('deploymentResultId=')[1];
		assert(deploymentResultId, `Can't extract deploymentResultId from resultsUrl: ${resultsUrl}`);

		// Read about this setTimeout magic in comments for `preliveDeployment` above
		setTimeout(() => {

			this._bamboo.getDeploymentResult(deploymentResultId)
				.then(data => {
					if (data.deploymentState === DEPLOYMENT_STATE.SUCCESS) {
						if (transitionCode === 'deployedToProduction') {
							this._jira.addComment(issueKey, COMMENT.DEPLOYED_TO_PRODUCTION);
						}
						return TransitionRouter.getTransitionFunction(this._jira, this._config.properties, transitionCode)(issueKey);
					}
					const err = `Deployment failed: [#${deploymentResultId}|${resultsUrl}]`;
					this._jira.addComment(issueKey, CommonHelpers.formatErrorForJira(err));

					// Execute fail transition
					TransitionRouter.getTransitionFunction(this._jira, this._config.properties, 'fail')(issueKey);
				})
				.catch(err => {
					logger.warn(err);
					// this._jira.addComment(issueKey, CommonHelpers.formatErrorForJira(err));
				});
		}, ASYNC_DELAY);

		// Return positive result as we want Bamboo deployment job to be completed asap
		ResponseHelpers.success(res);
	}
}

module.exports = DeploymentRouter;
