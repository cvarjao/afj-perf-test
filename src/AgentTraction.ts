import axios, { AxiosInstance } from "axios";
import { AriesAgent, ConnectionRef, CredentialOfferRef, Invitation } from "./Agent";
import { CredentialDefinitionBuilder, IssueCredentialPreviewV1, SchemaBuilder } from "./lib";
import { PersonCredential1 } from "./mocks";


async function waitForConnectionReady (config: any, http: AxiosInstance, connection_id:string, counter: number) {
    await http.get(`/connections/${connection_id}`, {
        headers:{
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.auth_token}`
        }
    })
    .then((value)=>{
        console.log(`connection state: ${value.data.state}`)
        if (value.data.state !== 'active') {
            return new Promise ((resolve) => {
                setTimeout(() => {
                    resolve(waitForConnectionReady(config, http, connection_id, counter + 1))
                }, 2000);
            })
        }
    })
}

export class AgentTraction implements AriesAgent {
    public axios: AxiosInstance;
    private config: any
    public constructor(config:any){
        this.config = config
        this.axios = axios.create({baseURL: config.base_url})
        /*
        this.axios.interceptors.request.use(function (config) {
            console.log(`Requesting ${config.url}`)
            return config;
          }, function (error) {
            // Do something with request error
            return Promise.reject(error);
        });
        */
    }
    findCredentialOffer(connectionId: string): Promise<CredentialOfferRef> {
        throw new Error("Method not implemented.");
    }
    acceptCredentialOffer(offer: CredentialOfferRef): Promise<void> {
        throw new Error("Method not implemented.");
    }
    receiveInvitation(invitation: Invitation): Promise<ConnectionRef> {
        throw new Error("Method not implemented.");
    }
    async createSchemaCredDefinition(credDefBuilder: CredentialDefinitionBuilder): Promise<string | undefined> {
        const http = this.axios
        const config = this.config
        const schemas = await http.get(`${config.base_url}/credential-definitions/created`, {
            params:{schema_name: credDefBuilder.getSchema()?.getName(), schema_version: credDefBuilder.getSchema()?.getVersion()},
            headers:{
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.auth_token}`
            }
        })
        const credential_definitions:any[] = []
        if (schemas.data.credential_definition_ids.length > 0) {
            const credential_definition_ids:string[] = schemas.data.credential_definition_ids
            for (const credential_definition_id of credential_definition_ids) {
                const credential_definition = await http.get(`${config.base_url}/credential-definitions/${credential_definition_id}`, {
                    headers:{
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${config.auth_token}`
                    }
                })
                const credDef = credential_definition.data
                if (!credDefBuilder.getSupportRevocation() && credDef.credential_definition.value.revocation === undefined){
                    credential_definitions.push(credDef)
                } else if (credDefBuilder.getSupportRevocation() && credDef.credential_definition.value.revocation !== undefined){
                    credential_definitions.push(credDef)
                }
            }
        }
        if (credential_definitions.length === 0){
            console.log('Creating Credential Definition ...')
            return await axios.post(`${config.base_url}/credential-definitions`,credDefBuilder.build(), {
                headers:{
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.auth_token}`
                }
            })
            .then((value)=>{
                console.log('Created CredDef')
                console.dir(value.data, {depth: 5, maxStringLength: 50})
                const credential_definition_id = value.data.sent.credential_definition_id
                //config.current_credential_definition_id=credential_definition_id
                console.log(`Credential Definition created '${credential_definition_id}'`)
                credDefBuilder.setId(credential_definition_id)
                return credential_definition_id as string
            })
        } else {
            const credDef = credential_definitions[0].credential_definition
            const credential_definition_id = credDef.id
            credDefBuilder.setId(credDef.id)
            credDefBuilder.setTag(credDef.tag)
            console.log(`Credential Definition found '${credential_definition_id}'`)
            return credential_definition_id as string
        }
    }
    async startup(): Promise<void> {
        const config = this.config
        if (config.tenant_id && config.api_key) {
            await axios.post(`${config.base_url}/multitenancy/tenant/${config.tenant_id}/token`,{"api_key":config.api_key})
            .then((value)=>{
                config.auth_token = value.data.token
            })
        }else {
            await axios.post(`${config.base_url}/multitenancy/wallet/${config.wallet_id}/token`,{"wallet_key":config.wallet_key})
            .then((value)=>{
                config.auth_token = value.data.token
            })
        }
    }
    async createInvitationToConnect(): Promise<Invitation> {
        const config = this.config
        const http = this.axios
        return http.post(`/connections/create-invitation`,{
            "my_label": `Faber\`s 😇 - ${new Date().getTime()}`,
            "image_url": "https://bc-wallet-demo-agent-admin.apps.silver.devops.gov.bc.ca/public/student/connection/best-bc-logo.png"
        }, {
            headers:{
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.auth_token}`
            }
        })
        .then((value)=>{
            console.dir(value.data)
            console.log(`invitation_url=${value.data.invitation_url}`)
            return {invitation_url: value.data.invitation_url, connection_id: value.data.connection_id}
        })
    }
    async createSchema(schemaBuilder: SchemaBuilder): Promise<string | undefined> {
        const config = this.config
        const schema = schemaBuilder.build()
        const schemas = await axios.get(`${config.base_url}/schemas/created`, {
            params:{schema_name: schema.schema_name, schema_version: schema.schema_version},
            headers:{
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.auth_token}`
            }
        })
        if (schemas.data.schema_ids.length === 0){
            console.log('Creating Schema ...')
            await axios.post(`${config.base_url}/schemas`, schema, {
                headers:{
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.auth_token}`
                }
            })
            .then((value)=>{
                schemaBuilder.setSchemaId(value.data.sent.schema_id)
                console.log(`Schema created '${value.data.sent.schema_id}'`)
                return value.data.sent.schema_id
            })
        } else {
            schemaBuilder.setSchemaId(schemas.data.schema_ids[0])
            console.log(`Schema found '${schemas.data.schema_ids[0]}'`)
            return schemas.data.schema_ids[0]
        }
    }
    async sendCredential(cred: IssueCredentialPreviewV1, credential_definition_id: string, connection_id: string): Promise<string | undefined> {
        const config = this.config
        const http = this.axios
        console.log(`Preparing Credential Request`)
        const data = {
            "auto_issue": true,
            "auto_remove": false,
            "connection_id": connection_id,
            "cred_def_id": credential_definition_id,
            "credential_preview": await cred.build(),
            "trace": true,
        }
        console.dir(data, {depth: 3, maxStringLength: 50})
        return await http.post(`/issue-credential/send-offer`,data, {
            headers:{
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.auth_token}`
            }
        })
        .then((value)=>{
            const credential_exchange_id = value.data.credential_exchange_id
            cred.setCredentialExchangeId(credential_exchange_id)
            console.log(`Credential offer sent!  ${credential_exchange_id}`)
            return credential_exchange_id
        })
    }
    async waitForConnectionReady (connection_id:string) {
        console.warn(`Waiting for connection ${connection_id} to get stablished`)
        await waitForConnectionReady(this.config, this.axios, connection_id, 0)
    }
    async waitForOfferAccepted (credential_exchange_id: string) {
        const config = this.config
        const http = this.axios
        await http.get(`${config.base_url}/issue-credential/records/${credential_exchange_id}`, {
            headers:{
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.auth_token}`
            }
        })
        .then((value)=>{
            console.log(`Credential Exchange state: ${value.data.state}`)
            if (value.data.state !== 'credential_acked') {    
                return new Promise ((resolve) => {
                    setTimeout(() => {
                        resolve(this.waitForOfferAccepted(credential_exchange_id))
                    }, 2000);
                })
            }
        })
    }
}