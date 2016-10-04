const COMMENT_HEADER = '*FTL automated message:* \n';

module.exports = {
	ERROR: {
		INTERNAL: 'INTERNAL_ERROR'
	},

	HTTP_METHOD: {
		POST: 'POST',
		GET: 'GET',
		PUT: 'PUT'
	},

	COLOUR: {
		GREEN: 'green',
		BLUE: 'blue'
	},

	HTTP_CODE: {
		OK: 200,
		BAD_REQUEST: 400
	},

	DEPLOYMENT_STATE: {
		FAILED: 'FAILED',
		SUCCESS: 'SUCCESS'
	},

	COMMENT: {
		HEADER: COMMENT_HEADER,

		YOLO_MODE: `${COMMENT_HEADER}YOLO mode activated! Issue will be deployed to prelive and production at the same time`,
		READY_FOR_PRELIVE: `${COMMENT_HEADER}This issue is marked as FTL and will be deployed as part of a new release`,
		DEPLOYED_TO_PRELIVE: `${COMMENT_HEADER}Release including this issue has been deployed to Prelive`,
		PRELIVE_DEPLOYMENT_FAIL: `${COMMENT_HEADER}Release including this issue failed deployment to Prelive`,
		DEPLOYED_TO_PRODUCTION: `${COMMENT_HEADER}Release including this issue has been deployed to Production`,
		PRODUCTION_DEPLOYMENT_FAIL: `${COMMENT_HEADER}Release including this issue failed deployment to Production`
	}
};
