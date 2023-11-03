## Setup
1. Clone Repository
1. Install dependencied
    ```
    yarn install
    ```
## Confifure your traction instance
1. Copy file `sample.local.env.json` to `local.env.json`
2. Configure agent:
    - `mediatorInvitationUrl`: Mediator Invitation URL
    - `base_url`: Traction API base URL
    - `tenant_id`: Traction tenant ID
    - `api_key`: Traction API Key
## Run Test
```
yarn run ts-node src/index.ts 
```