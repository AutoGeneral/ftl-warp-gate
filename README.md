# FTL Warp Gate

This is a middleware application that sits between Jira and Bamboo,
reacts on remote calls via webhooks executing workflow transitions
and operations needed for FTL deployments.

We're not expecting anyone to use it as is because everyone's workflow is different. However
this code can be utilised somewhere else.

# Development

Read CONTRIBUTING.md to learn more about contributing to this project.

## Run

Define `config` environment variable to run with custom configuration file:

```
config=./config/default.json node index.js
```

### Environment

for development I'd suggest to install Docker (locally or in VM) and run JIRA/Bamboo in container. That is extremely
easy to setup and fast to roll out

### API docs

This command will generate API docs into /docs folder

```
npm run-script docs
```

# Operation manual

## Credentials

FTL Warp Gate uses HTTP Basic Auth to send requests to Atlassian products so you will need:
- JIRA login/password
- Bamboo login/password

Add them into configuration file in `./config/<config>.json` as well as other params

## Properties file

There is a properies file in `./resources/properties.json` with some additional setup. Please read the JSON Schema
file `./resources/properties.schema.json` to get more information about configuration there.

## JIRA setup

### Workflow webhooks

You will have to specify some webhooks in JIRA to point to Warp Gate endpoints.
Setup can be different and depends on your workflows

```
Name: FTL - Build
URL: http://<warp.gate.address>/api/issue/${issue.key}/build
Events: No events selected
Exclude body: No
Transitions:
- AWAITING RELIEASE REVEIEW → Approved → READY FOR PRELIVE
```

```
Name: FTL - Deploy to production
URL: http://<warp.gate.address>/api/issue/${issue.key}/deploy/production
Events: No events selected
Exclude body: No
Transitions:
- PRELIVE TESTING → Pass → READY FOR PRODUCTION
```

```
Name: FTL - Release
URL: http://<warp.gate.address>/api/issue/${issue.key}/release
Events: No events selected
Exclude body: No
Transitions:
- SWAPPING COLOURS → Complete → DONE
```

### Transitions

Default setup for transitions as defined in `properties.json / transitions`:

- PRELIVE TESTING → Pass → READY FOR PRODUCTION
- AWAITING RELIEASE REVEIEW ← Things Went Wrong ← READY FOR PRELIVE
- READY FOR PRELIVE → Deploy To Prelive → DEPLOYING TO PRELIVE
- READY FOR PRELIVE ← Fail ← DEPLOYING TO PRELIVE
- DEPLOYING TO PRELIVE → Successful → PRELIVE TESTING
- READY FOR PRODUCTION → Deploy To Production → DEPLOYING TO PRODUCTION
- READY FOR PRODUCTION ← Fail ← DEPLOYING TO PRODUCTION
- DEPLOYING TO PRODUCTION → Successful → PRODUCTION TESTING

## Bamboo setup

### Build plan update

Build job in Bamboo must notify Warp Gate that build is finished by sending request to FTL endpoint.
Unfortunately there is no ability in Bamboo to send a webhook once build finished. That's why you
have to create new stage with one job that will send message to Warp Gate that build is about to finish.

Please make sure that is the last stage and job in the build plan.

```
curl -X POST $bamboo_FTLWarpGate/api/issue/$bamboo_issueKey/deploy/yolo \
     --header "Content-Type:application/json" \
     --data '{"planResultKey": "'$bamboo_planKey'-'$bamboo_buildNumber'", "issueKey": "'$bamboo_issueKey'"}'
```

Replace `deploy/yolo` by `deploy/prelive` in the URL if you don't want to be cool


### Deployment Environment update

Deployment jobs must notify Warp Gate about successful deployments. Just add additional script tasks to Prelive
and production deployment environments in Bamboo for FTL projects. That task must be final and the last

```
curl -X POST $bamboo_FTLWarpGate/api/issue/$bamboo_issueKey/deploy/validate \
     --header "Content-Type:application/json" \
     --data '{"resultsUrl": "'$bamboo_resultsUrl'", "transitionCode": "deployedToPrelive"}'
```

use `transitionCode = deployedToProduction` for production deployment

Those requests will trigger workflow transitions you need to do FTL warps


## License

The MIT License (MIT)

Copyright (c) 2016 Auto & General Insurance Company Ltd.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
