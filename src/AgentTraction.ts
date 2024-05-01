import axios, { AxiosInstance } from "axios";
import { Agent, ConnectionRef, Invitation } from "./Agent";

export class AgentTraction implements Agent {
    public axios: AxiosInstance;
    private config: any
    public constructor(config:any){
        this.config = config
        this.axios = axios.create({baseURL: config.base_url})
        this.axios.interceptors.request.use(function (config) {
            console.log(`Requesting ${config.url}`)
            return config;
          }, function (error) {
            // Do something with request error
            return Promise.reject(error);
        });
    }
    async authenticate(): Promise<void> {
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
    receiveInvitation(invitation: Invitation): ConnectionRef {
        throw new Error("Method not implemented.");
    }
}