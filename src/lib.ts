import axios, {AxiosInstance} from 'axios';
import { PersonCredential1 } from './mocks';
import { BaseLogger, LogLevel, ProofExchangeRecord } from '@credo-ts/core';
import { Logger } from 'pino';
import { AgentTraction } from './AgentTraction';
import { AriesAgent, ResponseCreateInvitation, ResponseCreateInvitationV1, ResponseCreateInvitationV2 } from './Agent';
import fs from 'node:fs';
import path from 'node:path';
import { log, dir} from "console"
import chalk from 'chalk';
import { AgentCredo } from './AgentCredo';
import { AnonCredsApi } from '@credo-ts/anoncreds';


export enum OOB_CONNECTION_HANDSHAKE_PROTOCOL {
    CONN_1_0 = "https://didcomm.org/connections/1.0",
    DIDX_1_1 = "https://didcomm.org/didexchange/1.1",
  }

export const toLocalISOString = (date:Date) =>{
    const tzoffset = (new Date()).getTimezoneOffset() // offset in minutes
    const tzoffsetInHours = Math.floor(tzoffset / 60) //offset in hours
    const tzoffsetInMilliseconds = tzoffset * 60000; //offset in milliseconds
    return (new Date(date.getTime() - tzoffsetInMilliseconds)).toISOString().slice(0, -1) + '-' + new String(tzoffsetInHours).padStart(2, '0')
}

export const seconds_since_epoch = (date:Date) =>{
    return Math.floor( date.getTime() / 1000 )
}

export class PinoLogger extends BaseLogger {
    logger: Logger
     constructor(logger:Logger, logLevel:LogLevel){
      super(logLevel)
      this.logger= logger
     }
      test(message: string, data?: Record<string, any> | undefined): void {
          this.logger.debug(data || {}, message)
      }
      trace(message: string, data?: Record<string, any> | undefined): void {
          this.logger.trace(data || {}, message)
      }
      debug(message: string, data?: Record<string, any> | undefined): void {
          this.logger.debug(data || {}, message, )
      }
      info(message: string, data?: Record<string, any> | undefined): void {
          this.logger.info(data || {}, message)
      }
      warn(message: string, data?: Record<string, any> | undefined): void {
          this.logger.warn(data || {}, message)
      }
      error(message: string, data?: Record<string, any> | undefined): void {
          this.logger.error(data || {}, message)
      }
      fatal(message: string, data?: Record<string, any> | undefined): void {
          //console.dir(data)
          this.logger.fatal(data || {}, message)
      }
      
  }
  
const sanitize = (obj: any) => {
    Object.keys(obj).forEach(key => {
        if (obj[key] === undefined) {
          delete obj[key];
        }
      });
    return obj
}

export const waitFor = (ms:number) => {
    return new Promise ((resolve) => {setTimeout(() => {resolve(true)}, ms);})
}

function _randomString(length: number) {
    // Declare all characters
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    // Pick characers randomly
    let str = '';
    for (let i = 0; i < length; i++) {
        str += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return str;
}

export class SchemaBuilder {
    private schema_id?: string
    private schema_name?: string;
    private schema_version?: string;
    private attributes?: string[];
    getSchemaId() {
        return this.schema_id
    }
    setSchemaId(value:string): SchemaBuilder {
        this.schema_id = value
        return this
    }
    getName() {
        return this.schema_name
    }
    setName(name:string) : SchemaBuilder {
        this.schema_name = name
        return this
    }
    getVersion() {
        return this.schema_version
    }
    setVersion(name:string) : SchemaBuilder {
        this.schema_version = name
        return this
    }
    getAttributes() {
        return this.attributes
    }
    setAttributes(attributes:string[]) : SchemaBuilder {
        this.attributes = attributes
        return this
    }
    build() {
        return sanitize({
            "schema_name": this.schema_name,
            "schema_version": this.schema_version,
            "attributes": this.attributes
        })
    }
}

export class CredentialDefinitionBuilder {
    private schema_id?:string
    private support_revocation: boolean=false
    private tag?:string
    private _schema?: SchemaBuilder
    private _id?:string
    setId(value: any) {
        this._id = value
        return this
    }
    getId() {
        return this._id
    }
    setSchema(value:SchemaBuilder) {
        this._schema = value
        return this
    }
    getSchema() {
        return this._schema
    }
    public setSchemaId(value:string) {
        this.schema_id = value
        return this
    }
    public  getSchemaId() {
        return this.schema_id
    }
    public setSupportRevocation(value:boolean) {
        this.support_revocation = value
        return this
    }
    public getSupportRevocation() {
        return this.support_revocation
    }
    public setTag(value:string) {
        this.tag = value
        return this
    }
    public getTag() {
        return this.tag?? (this.support_revocation ? "revocable":"irrevocable")
    }
    public build() {
        return sanitize({
            "schema_id": this.schema_id??this._schema?.getSchemaId(),
            "support_revocation": this.support_revocation,
            "revocation_registry_size": 100,
            "tag": this.getTag()
        })
    }
}

export class RequestAttributeBuilder {
    private names: string[] = [];
    private restrictions: any[] = []
    private nonRevoked?:any
    getNames() {
        return this.names
    }
    setNames(names:string[]) {
        this.names = names
        return this
    }
    setNonRevoked(value:number) {
        this.nonRevoked = { from: value, to: value}
        return this
    }
    addRestriction(retriction: any) {
        this.restrictions.push(retriction)
        return this
    }
    build() {
        console.log('nonRevoked')
        console.dir(this.nonRevoked)
        return sanitize({
            names: this.names,
            restrictions: this.restrictions,
            non_revoked: this.nonRevoked
        })
    }
}

export class IssueCredentialPreviewV1 {
    private attributes: any[] = []
    private _revocation_id?: string
    private _revoc_reg_id?: string
    private _credential_exchange_id?: string
    private _connection_id?: string
    private _cred_def?: CredentialDefinitionBuilder;
    setCredDef(cred_def: CredentialDefinitionBuilder) {
        this._cred_def = cred_def
    }
    getCredDef() {
        return this._cred_def
    }
    setConnectionId(connection_id: any) {
        this._connection_id = connection_id
    }
    getConnectionId() {
        return this._connection_id
    }
    setRevocationId(revocation_id: string) {
        this._revocation_id = revocation_id
        return this
    }
    getRevocationId() {
        return this._revocation_id
    }
    setRevocationRegisttryId(revoc_reg_id: string) {
        this._revoc_reg_id = revoc_reg_id
        return this
    }
    getRevocationRegisttryId() {
        return this._revoc_reg_id
    }
    setCredentialExchangeId(credential_exchange_id: string) {
        this._credential_exchange_id = credential_exchange_id
        return this
    }
    getCredentialExchangeId() {
        return this._credential_exchange_id
    }
    getAttributes() {
        return this.attributes
    }
    addAttribute({name, value}: {name: string, value: string}) {
        this.attributes.push({name: name, value: value})
        return this
    }
    async build () {
        return {
            "@type": "issue-credential/1.0/credential-preview",
            "attributes": this.attributes,
            "~timing": {
                "in_time": new Date().toISOString()
            }
        }
    }
}

export class ProofRequestBuilder {
    private name: string = "proof-request"
    private version: string = "1.0"
    private requested_attributes: any = {}
    private requested_predicates: any = {}
    private nonce:string = "1234567890" //randomString(10)
    private non_revoked?: any = undefined

    getName() {
        return this.name
    }
    setName(name:string) {
        this.name = name
        return this
    }
    getVersion() {
        return this.version
    }
    setVersion(name:string) {
        this.version = name
        return this
    }
    public setNonRevoked(): ProofRequestBuilder
    public setNonRevoked(instant?: Date): ProofRequestBuilder {
        const ref = instant??new Date()
        this.non_revoked = {"from":ref.getTime(), "to": ref.getTime()}
        return this
    }

    addRequestedAttribute(group: string, attribute:RequestAttributeBuilder) {
        this.requested_attributes[group] = attribute.build()
        return this
    }
    build() {
        return sanitize({
            "name": this.name,
            "version": this.version,
            "nonce": this.nonce,
            "non_revoked": this.non_revoked,
            "requested_attributes": this.requested_attributes,
            "requested_predicates": this.requested_predicates,
        })
    }
    buildv2() {
        return sanitize({
            "indy":{
                "name": this.name,
                "version": this.version,
                "nonce": this.nonce,
                "non_revoked": this.non_revoked,
                "requested_attributes": this.requested_attributes,
                "requested_predicates": this.requested_predicates,
            }
        })
    }
}
export const createPersonSchema =  async (config: any, _state: any, schemaBuilder: SchemaBuilder) => {
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
            config.current_schema_id=value.data.sent.schema_id
        })
    } else {
        schemaBuilder.setSchemaId(schemas.data.schema_ids[0])
        console.log(`Schema found '${schemas.data.schema_ids[0]}'`)
        config.current_schema_id=schemas.data.schema_ids[0]
    }
}

export const createPersonSchemaCredDefinition =  async (config:any, _state:any, credDefBuilder: CredentialDefinitionBuilder) => {
    const schemas = await axios.get(`${config.base_url}/credential-definitions/created`, {
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
            const credential_definition = await axios.get(`${config.base_url}/credential-definitions/${credential_definition_id}`, {
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
        await axios.post(`${config.base_url}/credential-definitions`,credDefBuilder.build(), {
            headers:{
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.auth_token}`
            }
        })
        .then((value)=>{
            console.log('Created CredDef')
            console.dir(value.data, {depth: 5, maxStringLength: 50})
            const credential_definition_id = value.data.sent.credential_definition_id
            config.current_credential_definition_id=credential_definition_id
            console.log(`Credential Definition created '${credential_definition_id}'`)
        })
    } else {
        const credDef = credential_definitions[0].credential_definition
        const credential_definition_id = credDef.id
        credDefBuilder.setId(credDef.id)
        credDefBuilder.setTag(credDef.tag)
        console.log(`Credential Definition found '${credential_definition_id}'`)
        config.current_credential_definition_id=credential_definition_id
    }
}

export const createAuthToken =  async (config: any, _state: any) => {
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

export const createInvitationToConnect = async (ctx:Context, _state:any) => {
    const config = ctx.config
    const http = ctx.axios
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
        config.current_invitation=value.data.invitation
        config.current_invitation_url=value.data.invitation_url
        config.current_connection_id=value.data.connection_id
        return value.data
    })
}

export const acceptInvitationToConnect = async (config: any, _state: any) => {
    await axios.post(`${config.base_url}/connections/receive-invitation`,config.current_invitation, {
        params: {
            "alias": "Alice",
        },
        headers:{
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.auth_token}`
        }
    })
    .then((_value)=>{
        console.log('Acceppted connection')
        //console.dir(value.data)
    })
}
export const waitForProofRequest = async (config: any, state: any) => {
    //console.log(`/present-proof/records/${config.presentation_exchange_id}`)
    return axios.get(`${config.base_url}/present-proof/records/${config.presentation_exchange_id}`, {
        headers:{
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.auth_token}`
        }
    })
    .then(printResponse)
    .then((value)=>{
        console.log(`proof request state: ${value.data.state}`)
        if (!(value.data.state === 'verified' || value.data.state === 'abandoned')) {
            return new Promise ((resolve) => {
                setTimeout(() => {
                    resolve(waitForProofRequest(config, state))
                }, 2000);
            })
        }
    })
}

export const waitForConnectionReady = async (ctx: Context, state: any) => {
    const config = ctx.config
    const http = ctx.axios
    await http.get(`/connections/${config.current_connection_id}`, {
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
                    resolve(waitForConnectionReady(ctx, state))
                }, 2000);
            })
        }
    })
}

export const waitForCredentialRevoked = async (config: any, state: any, cred: IssueCredentialPreviewV1) => {
    await axios.get(`${config.base_url}/revocation/credential-record`, {
        params: {
            //"cred_ex_id": cred.getCredentialExchangeId(),
            "cred_rev_id": cred.getRevocationId(),
            "rev_reg_id": cred.getRevocationRegisttryId()
        },
        headers:{
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.auth_token}`
        }
    })
    .then((value)=>{
        //console.log('waitForCredentialRevoked:')
        //console.dir(value.data, {depth: 5, maxStringLength: 50})
        console.log(`revocation status: ${value.data?.result?.state}`)
        if (value.data?.result?.state !== 'revoked') {
            //console.log(`connection state: ${value.data.state}`)
            return new Promise ((resolve) => {
                setTimeout(() => {
                    resolve(waitForCredentialRevoked(config, state, cred))
                }, 2000);
            })
        }
    })
}

export const waitForOfferAccepted = async (config: any, state: any, cred: IssueCredentialPreviewV1) => {
    await axios.get(`${config.base_url}/issue-credential/records/${cred.getCredentialExchangeId()}`, {
        headers:{
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.auth_token}`
        }
    })
    .then((value)=>{
        if (value.data.state !== 'credential_acked') {
            //console.log('Issued Credential:')
            //console.dir(value.data, {maxStringLength: 50, depth: 5})
            cred.setRevocationId(value.data.revocation_id)
            cred.setRevocationRegisttryId(value.data.revoc_reg_id)
            cred.setConnectionId(value.data.connection_id)

            //console.log(`connection state: ${value.data.state}`)
            return new Promise ((resolve) => {
                setTimeout(() => {
                    resolve(waitForOfferAccepted(config, state, cred))
                }, 2000);
            })
        }
        //else { console.dir(value.data) }
    })
}

export const sendPersonCredential = async (ctx: Context, _state: any, cred: IssueCredentialPreviewV1) => {
    //const image =  await Jimp.read(path.join(__dirname, 'assets/photo.jpeg')).then((image)=> {return image.scale(1.5)}).then(image=>{return image.getBase64Async(image.getMIME())})
    //const photoValue = image
    //const photoValueSize = Buffer.byteLength(photoValue)
    //console.log(`photoValue:\n${photoValueSize} bytes / ${Math.round(photoValueSize /1024)} kb, ${photoValue.length} chars`)
    //console.log(`photoValue:\n${photoValue.substring(0, 100)}`)
    const config = ctx.config
    const http = ctx.axios
    console.log(`Preparing Credential Request`)
    const data = {
        "auto_issue": true,
        "auto_remove": false,
        "connection_id": ctx.config.current_connection_id,
        "cred_def_id": config.current_credential_definition_id,
        "credential_preview": await cred.build(),
        "trace": true,
    }
    console.dir(data, {depth: 3, maxStringLength: 50})
    await http.post(`/issue-credential/send-offer`,data, {
        headers:{
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.auth_token}`
        }
    })
    .then((value)=>{
        cred.setCredentialExchangeId(value.data.credential_exchange_id)
        const credential_exchange_id = value.data.credential_exchange_id
        config.current_credential_exchange_id=credential_exchange_id
        console.log(`Credential offer sent!  ${credential_exchange_id}`)
    })
}

export const printResponse = (response: any) => {
    log(`> ${response.request.method} > ${response.request.path}`)
    dir(response.data,{depth: 6})
    return response
}

export const extractResponseData = (response: any) => {
    return response.data
}

export const sendProofRequest = async (config: any, _state: any, proofRequest: ProofRequestBuilder) => {
    await axios.post(`${config.base_url}/present-proof/send-request`,{
        "trace": false,
        "auto_verify": false,
        "comment": "Hello",
        "connection_id": config.current_connection_id,
        "proof_request": proofRequest.build()
    }, {
        headers:{
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.auth_token}`
        }
    })
    .then((value)=>{
        console.log('sendProofRequest:')
        console.dir(value.data, {depth: 6, maxStringLength: 50})
        config.presentation_exchange_id = value.data.presentation_exchange_id 
        //const credential_exchange_id = value.data.credential_exchange_id
        //config.current_credential_exchange_id=credential_exchange_id
        //console.log(`Credential offer sent!  ${credential_exchange_id}`)
    })
}

export class Context {
    public config: any;
    public state: any;
    public axios: AxiosInstance;
    constructor(config:any){
        this.config = config
        this.state = config
        this.axios = axios.create({baseURL: config.base_url})
        this.axios.interceptors.request.use(function (config) {
            console.log(`Requesting ${config.url}`)
            return config;
          }, function (error) {
            // Do something with request error
            return Promise.reject(error);
        });
        //this.config.axios = axios
    }
    acceptInvitationToConnect() {
        return acceptInvitationToConnect(this.config, this.state)
    }
    sendProofRequest(builder: ProofRequestBuilder) {
        return sendProofRequest(this.config, this.state, builder)
    }
    waitForOfferAccepted(cred: IssueCredentialPreviewV1) {
        return waitForOfferAccepted(this.config, this.state, cred)
    }
    sendCredential(cred: IssueCredentialPreviewV1) {
        return sendPersonCredential(this, this.state, cred)
    }
    waitForConnectionReady() {
        return waitForConnectionReady(this, this.state)
    }
    public async createInvitationToConnect() {
        return createInvitationToConnect(this, this.state)
    }
    public async createAuthToken() {
        return createAuthToken(this.config, this.state)
    }
    public async createSchema( builder: SchemaBuilder) : Promise<Context> {
        return createPersonSchema(this.config, this.state, builder)
        .then(()=>{
            return this
        })
    }
    public async createCredentialDefinition(credDefBuilder: CredentialDefinitionBuilder) : Promise<Context> {
        return createPersonSchemaCredDefinition(this.config, this.state, credDefBuilder)
        .then(()=>{
            return this
        })
    }
    public async sendConnectionlessProofRequest(builder: ProofRequestBuilder) {
        const proofRequest = builder.build()
        const wallet = await axios.get(`${this.config.base_url}/wallet/did/public`, {
            params: {},
            headers:{
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.auth_token}`
            }
        })
        //.then(printResponse)
        .then(extractResponseData)
        // serviceEndpoint: 'https://traction-acapy-dev.apps.silver.devops.gov.bc.ca'

        //throw new Error("Stop here")
        const proof = await axios.post(`${this.config.base_url}/present-proof/create-request`,{
            "auto_remove": true,
            "auto_verify": true,
            "comment": "string",
            "trace": false,
            proof_request: proofRequest
        }, {
            params: {},
            headers:{
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.auth_token}`
            }
        })
        .then(printResponse)
        .then(extractResponseData)
        //console.log('presentation_request_dict')
        //console.dir(proof.presentation_request_dict, {depth: 5, maxStringLength: 50})
        const invitation = JSON.parse(JSON.stringify(proof.presentation_request_dict))
        this.config.presentation_exchange_id = proof.presentation_exchange_id
        invitation['comment']= null
        invitation['~service']= {
            "recipientKeys": [wallet.result.verkey],
            "routingKeys": null,
            "serviceEndpoint": "https://traction-tenant-proxy-dev.apps.silver.devops.gov.bc.ca"
        }
        return Promise.resolve(invitation).then(value => {
            //console.log('invitation:')
            //console.log(JSON.stringify(value, undefined, 2))
            const baseUrl = 'didcomm://launch'
            const url = new URL(baseUrl)
            url.searchParams.append('d_m', Buffer.from(JSON.stringify(value, undefined, 2)).toString('base64'))
            //this.config.current_invitation_url=url.toString() // does NOT work
            //this.config.current_invitation_url=Buffer.from(JSON.stringify(value, undefined, 2)).toString('base64') // does NOT work
            //this.config.current_invitation_url=baseUrl+'?c_i='+encodeURIComponent(Buffer.from(JSON.stringify(value, undefined, 2)).toString('base64')) // does NOT work
            this.config.current_invitation_url=JSON.stringify(value) // works
            
            return value
        })
        
    }
    public async sendOOBProofRequest(builder: ProofRequestBuilder) {
        const proofRequest = builder.build()
        return axios.post(`${this.config.base_url}/present-proof/create-request`,{
            "auto_remove": true,
            "auto_verify": false,
            "comment": "string",
            "trace": false,
            proof_request: proofRequest
        }, {
            params: {},
            headers:{
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.auth_token}`
            }
        })
        .then ((response) => {
            //console.log(`> ${response.request.path}`)
            //console.dir(response.data)
            return response
        })
        .then ((response) => {
            const data = response.data
            this.config.presentation_exchange_id = data.presentation_exchange_id
            return axios.post(`${this.config.base_url}/out-of-band/create-invitation`, {
                "accept": [
                    "didcomm/aip1",
                    "didcomm/aip2;env=rfc19"
                  ],
                "alias": "Barry",
                "my_label": "Invitation to Barry",
                "protocol_version": "1.1",
                "use_public_did": false,
                "attachments": [
                    {
                      "id": data.presentation_exchange_id,
                      "type": "present-proof"
                    }
                  ],
            }, {
                params: {},
                headers:{
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.auth_token}`
                }
            })
        })
        .then ((response) => {
            const data = response.data
            //console.log(`> ${response.request.path}`)
            //console.dir(response.data)
            this.config.current_invitation=data.invitation
            this.config.current_invitation_url=data.invitation_url
            return response
        })
    }
    public async waitForPresentation() {
        console.log(`Waiting for Presentation ...`)
        return waitForProofRequest(this.config, this.state)
    }
    public async revokeCredential(personCred: IssueCredentialPreviewV1) {
        const response = await axios.post(`${this.config.base_url}/revocation/revoke`, {
            "comment": "You have been bad!",
            "connection_id": personCred.getConnectionId(),
            "cred_rev_id": personCred.getRevocationId(),
            "notify": true,
            "notify_version": "v1_0",
            "publish": true,
            "rev_reg_id": personCred.getRevocationRegisttryId()
          }, {
            params: {},
            headers:{
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.auth_token}`
            }
        })
        return Promise.resolve(response.data)
    }
    public async waitForCredentialRevoked(cred: IssueCredentialPreviewV1) {
        return waitForCredentialRevoked(this.config, this.state, cred)
    }
    public getCurrentInvitationUrl(): string {
        return this.config.current_invitation_url
    }
}

export const issueCredential = async (issuer:AgentTraction, holder: AriesAgent, cred: PersonCredential1)  => {
    const { logger } = issuer
    const remoteInvitation = await issuer.createInvitationToConnect() as ResponseCreateInvitationV1
    logger.info(`waiting for holder to accept connection`)
    const agentBConnectionRef1 = await holder.receiveInvitation(remoteInvitation)
    logger.info(`waiting for issuer to accept connection`)
    await issuer.waitForConnectionReady(remoteInvitation.payload.connection_id as string)
    logger.info(`${remoteInvitation.payload.connection_id} connected to ${agentBConnectionRef1.connectionRecord?.connection_id}`)
    logger.info('agentBConnectionRef1', agentBConnectionRef1)
    const credential_exchange_id = await issuer.sendCredential(cred, cred.getCredDef()?.getId() as string, remoteInvitation.payload.connection_id as string)
    const offer = await holder.findCredentialOffer(agentBConnectionRef1.connectionRecord?.connection_id as string)
    await holder.acceptCredentialOffer(offer)
    await issuer.waitForOfferAccepted(credential_exchange_id as string)
}

/**
 * Connectionless (Connection/v1)
 */
export const verifyCredentialA1 = async (verifier:AriesAgent, holder: AriesAgent, proofRequest: ProofRequestBuilder)  => {
    const { logger } = verifier
    const remoteInvitation2 = await verifier.sendConnectionlessProofRequest(proofRequest) as ResponseCreateInvitationV1
    const agentBConnectionRef2 = await holder.receiveInvitation(remoteInvitation2)
    //console.dir(['agentBConnectionRef', agentBConnectionRef2])
    if (agentBConnectionRef2.invitationRequestsThreadIds){
        logger.info('outOfBandInvitation.getRequests():' ,agentBConnectionRef2.outOfBandRecord?.outOfBandInvitation.getRequests())
      for (const proofId of agentBConnectionRef2.invitationRequestsThreadIds) {
        log(chalk.yellowBright(`> AgentCredo=${holder instanceof AgentCredo}`))
        if (holder instanceof AgentCredo) {
            const agent = (holder as AgentCredo).agent
            let proofs: ProofExchangeRecord[] = []
            while (proofs.length == 0) {
                proofs = await agent.proofs.findAllByQuery({threadId: proofId})
                await waitFor(1000)
            }
            logger.info(`agent.proofs.getAll() size:${proofs.length}:`, proofs)
            
            const credentials = await agent.proofs.getCredentialsForRequest({proofRecordId: proofs[0].id})
            for (const key in credentials.proofFormats.indy?.attributes) {
                const items = credentials.proofFormats.indy?.attributes[key]
                for (let index = 0; index < items.length; index++) {
                    const element = items[index];
                    logger.info(`indy.attributes[${key}][${index}].credentialId = ` + element)
                    logger.info(`indy.attributes[${key}][${index}].credentialInfo.revocationRegistryId = ` + element.credentialInfo.revocationRegistryId)
                    logger.info(`indy.attributes[${key}][${index}].credentialInfo.credentialId = ` + element.credentialInfo.credentialId)
                    logger.info(`indy.attributes[${key}][${index}].credentialInfo.credentialRevocationId = ` + element.credentialInfo.credentialRevocationId)
                }
                
            }
            
            logger.info('anoncreds.attributes:', credentials.proofFormats.anoncreds?.attributes)
            const anonCredsApi = agent.dependencyManager.resolve(AnonCredsApi)
            logger.info(`anonCredsApi.config.anoncreds.version = ${anonCredsApi.config.anoncreds.version}`)
            //anonCredsApi.getRevocationStatusList()
            //anonCredsApi.getRevocationStatusList()
            //await waitFor(10_000)
            //throw new Error('something')
            //await holder.acceptProof({id: proofId})
        }
        log(chalk.yellowBright(`> getting ready to send proof in 10s`))
        //await waitFor(10_000)
        await holder.acceptProof({id: proofId})
      }
    }
    await verifier.waitForPresentation(remoteInvitation2.payload.presentation_exchange_id as string)
  }
/**
 * Connectionless (Connection/v1) with http request
 */
export const verifyCredentialA2 = async (verifier:AriesAgent, holder: AriesAgent, proofRequest: ProofRequestBuilder)  => {
    const remoteInvitation2 = await withRedirectUrl(await verifier.sendConnectionlessProofRequest(proofRequest)) as ResponseCreateInvitationV1
    const agentBConnectionRef2 = await holder.receiveInvitation(remoteInvitation2)
    //console.dir(['agentBConnectionRef', agentBConnectionRef2])
    if (agentBConnectionRef2.invitationRequestsThreadIds){
      for (const proofId of agentBConnectionRef2.invitationRequestsThreadIds) {
        await holder.acceptProof({id: proofId})
      }
    }
    await verifier.waitForPresentation(remoteInvitation2.payload.presentation_exchange_id as string)
  }

  /**
   * Connectionless (OOB) with encoded payload
   */
  export const verifyCredentialB1 = async (verifier:AriesAgent, holder: AriesAgent, proofRequest: ProofRequestBuilder)  => {
    const { logger } = verifier
    const remoteInvitation3 = await verifier.sendOOBConnectionlessProofRequest(proofRequest) as ResponseCreateInvitationV2
    logger.info('remoteInvitation3', remoteInvitation3)
    logger.info(`Holder is receiving invitation for ${remoteInvitation3.payload.presentation_exchange_id}`)
    const agentBConnectionRef3 =await holder.receiveInvitation(remoteInvitation3)
    logger.info('Holder is accepting proofs')
    //await waitFor(10000)
    if (agentBConnectionRef3.invitationRequestsThreadIds){
      for (const proofId of agentBConnectionRef3.invitationRequestsThreadIds) {
        await holder.acceptProof({id: proofId})
      }
    }
    logger.info(`Verifier is waiting for proofs: ${remoteInvitation3.payload.presentation_exchange_id}`)
    await verifier.waitForPresentation(remoteInvitation3.payload.presentation_exchange_id as string)
  }
  
  /**
   * Connectionless (OOB) with URL
   */
  export const verifyCredentialB2 = async (verifier:AriesAgent, holder: AriesAgent, proofRequest: ProofRequestBuilder)  => {
    const { logger } = verifier
    const remoteInvitation3 = await withRedirectUrl(await verifier.sendOOBConnectionlessProofRequest(proofRequest)) as ResponseCreateInvitationV2
    logger.info('remoteInvitation3', remoteInvitation3)
    logger.info('Holder is receiving invitation')
    const agentBConnectionRef3 =await holder.receiveInvitation(remoteInvitation3)
    logger.info('Holder is accepting proofs')
    if (agentBConnectionRef3.invitationRequestsThreadIds){
      for (const proofId of agentBConnectionRef3.invitationRequestsThreadIds) {
        await holder.acceptProof({id: proofId})
      }
    }
    logger.info('Verifier is waiting for proofs')
    await verifier.waitForPresentation(remoteInvitation3.payload.presentation_exchange_id as string)
  }
  export const withRedirectUrl = async (remoteInvitation3: ResponseCreateInvitation): Promise<ResponseCreateInvitation> => {
    const invitationFile = `${remoteInvitation3.payload.invitation['@id']}.json`
    fs.writeFileSync(path.join(process.cwd(), `/tmp/${invitationFile}`), JSON.stringify(remoteInvitation3.payload.invitation, undefined, 2))
    const publicUrl = await axios.get('http://127.0.0.1:4040/api/tunnels').then((response)=>{return response.data.tunnels[0].public_url as string})
    remoteInvitation3.payload.invitation_url = `${publicUrl}/${invitationFile}`

    return remoteInvitation3
  }