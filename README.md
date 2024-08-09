## Setup
1. Clone Repository
```
git clone <git repository url>
```
1. Install dependencies
```
yarn install
```
## Configure your traction instance
### Automatically Generate using traction sandbox environment

```
yarn ts-node src/setup-from-sandbox.ts
```

### Manually create the local env file
1. Copy file `sample.local.env.json` to `local.env.json`
2. Configure agent:
    - `mediatorInvitationUrl`: Mediator Invitation URL
    - `base_url`: Traction API base URL
    - `tenant_id`: Traction tenant ID
    - `api_key`: Traction API Key

## In terminal 1, start ngrok service
```
ngrok http "file://${PWD}/tmp"
```
## In terminal 2, run tests
```
yarn jest --runInBand --detectOpenHandles --forceExit
```