## Setup
1. Clone Repository
1. Install dependencied
    ```
    yarn install
    ```
## Configure your traction instance
### Automatically Generate using traction sandbox enrionment
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

## Start ngrok service
```
ngrok http "file://${PWD}/tmp"
```
## Run Test
```
yarn run ts-node src/index2.ts
```